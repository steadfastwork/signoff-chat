/**
 * UploadThing file router — with mandatory CSAM scanning.
 *
 * Every upload is scanned BEFORE the URL is returned to the app.
 * Unsafe files are deleted from storage immediately; the uploader is
 * permanently suspended and a SafetyIncident record is created.
 *
 * For CSAM matches an NCMEC CyberTipline report is filed (see lib/safety/ncmec.ts).
 * The uploader is never informed that a scan occurred or that a report was filed.
 */

import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scanUpload, type ScanResult } from "@/lib/safety/hashCheck";
import { fileNCMECReport } from "@/lib/safety/ncmec";
import { preserveEvidence } from "@/lib/safety/preserve";

const f      = createUploadthing();
const utapi  = new UTApi();

// ---------------------------------------------------------------------------
// Upload safety enforcement
//
// Called inside every onUploadComplete handler.
// Returns true if the file is safe; false if it was deleted.
// ---------------------------------------------------------------------------

async function enforceContentSafety(params: {
  userId:       string;
  screenname:   string;
  emailHash:    string;
  fileUrl:      string;
  fileKey:      string;
  mimeType:     string;
  fileSizeBytes: number;
}): Promise<{ safe: boolean; scan: ScanResult }> {
  const { userId, screenname, emailHash, fileUrl, fileKey, mimeType } = params;

  // 1. Fetch the file buffer from UploadThing's CDN
  let fileBuffer: Buffer;
  try {
    const res = await fetch(fileUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    fileBuffer = Buffer.from(await res.arrayBuffer());
  } catch (fetchErr) {
    // Cannot fetch file — fail safe: delete and block
    console.error("[SAFETY] Cannot fetch upload for scanning, blocking upload:", fetchErr);
    await utapi.deleteFiles(fileKey).catch(() => {});
    return {
      safe: false,
      scan: {
        safe:         false,
        matchType:    "KNOWN_HARMFUL",
        confidence:   1.0,
        provider:     "FETCH_FAILURE",
        allProviders: [],
        scannedAt:    new Date(),
      },
    };
  }

  // 2. Run all three scan providers
  const scan = await scanUpload(fileBuffer, mimeType, fileKey);

  if (scan.safe) {
    return { safe: true, scan };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UNSAFE CONTENT DETECTED
  // ─────────────────────────────────────────────────────────────────────────

  // 3. Preserve evidence BEFORE deleting — encrypted copy to S3 with Object Lock.
  // Failure is non-fatal; incident is still created without preservedPath.
  let preservedPath: string | undefined;
  let contentHash: string | undefined;
  let preservedAt: Date | undefined;
  try {
    const preservation = await preserveEvidence(fileUrl, "pending", mimeType);
    preservedPath = preservation.s3Key;
    contentHash   = preservation.contentHash;
    preservedAt   = preservation.preservedAt;
  } catch (preserveErr) {
    console.error("[SAFETY] Evidence preservation failed — continuing without preserved copy:", preserveErr);
  }

  // 4. Delete the file from UploadThing
  await utapi.deleteFiles(fileKey).catch((err) => {
    console.error("[SAFETY] Failed to delete unsafe file from storage:", fileKey, err);
  });

  // 5. Suspend the uploader account permanently (no grace period, no notice)
  await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended:    true,
      suspendedAt:    new Date(),
      suspendedUntil: null,  // null = permanent
      suspendReason:  "CONTENT_SAFETY_VIOLATION",
    },
  }).catch((err) => {
    console.error("[SAFETY] Failed to suspend uploader account:", userId, err);
  });

  // 6. Write the SafetyIncident audit record
  const allProvidersJson = JSON.stringify(
    scan.allProviders.map((p) => ({
      provider:   p.provider,
      safe:       p.safe,
      matchType:  p.matchType,
      confidence: p.confidence,
      detail:     p.detail,
    }))
  );

  // Map scan matchType to IncidentType enum.
  // While Rekognition is the only provider, CSAM cannot be confirmed via
  // hash matching — classify as CSAM_SUSPECTED and report conservatively.
  const incidentType = scan.matchType === "CSAM" ? "CSAM" : "CSAM_SUSPECTED";

  let incident: { id: string } | null = null;
  try {
    incident = await prisma.safetyIncident.create({
      data: {
        incidentType:      incidentType as any,
        status:            "ACCOUNT_SUSPENDED" as any,
        uploaderId:        userId,
        uploaderName:      screenname,
        uploaderEmailHash: emailHash,
        contentUrl:        fileUrl,
        fileKey,
        contentType:       mimeType,
        fileSizeBytes:     params.fileSizeBytes,
        contentHash,
        matchProvider:     scan.provider,
        matchConfidence:   scan.confidence,
        allProviders:      allProvidersJson,
        scannedAt:         scan.scannedAt,
        actionsTaken:      "FILE_DELETED,ACCOUNT_SUSPENDED",
        preservedPath,
        preservedAt,
      },
      select: { id: true },
    });
  } catch (dbErr) {
    console.error("[SAFETY] Failed to write SafetyIncident record:", dbErr);
  }

  // 6. File NCMEC CyberTipline report for all unsafe content (fire-and-forget).
  // With Rekognition as the only provider, CSAM cannot be confirmed via hash —
  // we report everything conservatively rather than risk under-reporting.
  if (incident) {
    fileNCMECReport({
      incidentId:        incident.id,
      uploaderId:        userId,
      uploaderName:      screenname,
      uploaderEmailHash: emailHash,
      fileUrl,
      mimeType,
      incidentType:      incidentType as "CSAM" | "CSAM_SUSPECTED",
      provider:          scan.provider,
      confidence:        scan.confidence,
      detectedAt:        scan.scannedAt,
    }).catch((err) => {
      console.error("[SAFETY] NCMEC report pipeline error:", err);
    });
  }

  return { safe: false, scan };
}

// ---------------------------------------------------------------------------
// File router
// ---------------------------------------------------------------------------

export const ourFileRouter = {
  /**
   * Profile images — scanned before URL is returned to the client.
   * Unsafe uploads are silently blocked; the client receives no useful
   * error detail (just a generic failure).
   */
  profileImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getSession();
      if (!session?.user?.id) throw new Error("unauthorized");

      // Load emailHash for the audit record
      const user = await prisma.user.findUnique({
        where:  { id: session.user.id },
        select: { screenname: true, emailHash: true, isSuspended: true },
      });
      if (!user)              throw new Error("user not found");
      if (user.isSuspended)   throw new Error("account suspended");

      return {
        userId:     session.user.id,
        screenname: user.screenname,
        emailHash:  user.emailHash,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const { safe } = await enforceContentSafety({
        userId:        metadata.userId,
        screenname:    metadata.screenname,
        emailHash:     metadata.emailHash,
        fileUrl:       file.url,
        fileKey:       file.key,
        mimeType:      file.type,
        fileSizeBytes: file.size,
      });

      if (!safe) {
        // Return no useful data to the client — they get a generic upload error.
        // Never reveal that a safety scan occurred or that a report was filed.
        throw new Error("upload failed");
      }

      return { userId: metadata.userId, url: file.url };
    }),

  /**
   * Post media (images, GIFs, short video clips).
   * Same scanning pipeline as profile images.
   */
  postMedia: f({
    image: { maxFileSize: "8MB",  maxFileCount: 1 },
    video: { maxFileSize: "64MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await getSession();
      if (!session?.user?.id) throw new Error("unauthorized");

      const user = await prisma.user.findUnique({
        where:  { id: session.user.id },
        select: { screenname: true, emailHash: true, isSuspended: true },
      });
      if (!user)            throw new Error("user not found");
      if (user.isSuspended) throw new Error("account suspended");

      return {
        userId:     session.user.id,
        screenname: user.screenname,
        emailHash:  user.emailHash,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const { safe } = await enforceContentSafety({
        userId:        metadata.userId,
        screenname:    metadata.screenname,
        emailHash:     metadata.emailHash,
        fileUrl:       file.url,
        fileKey:       file.key,
        mimeType:      file.type,
        fileSizeBytes: file.size,
      });

      if (!safe) throw new Error("upload failed");

      return { userId: metadata.userId, url: file.url };
    }),

  /**
   * Channel / board media attachments.
   */
  channelMedia: f({
    image: { maxFileSize: "8MB",  maxFileCount: 1 },
    video: { maxFileSize: "64MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await getSession();
      if (!session?.user?.id) throw new Error("unauthorized");

      const user = await prisma.user.findUnique({
        where:  { id: session.user.id },
        select: { screenname: true, emailHash: true, isSuspended: true },
      });
      if (!user)            throw new Error("user not found");
      if (user.isSuspended) throw new Error("account suspended");

      return {
        userId:     session.user.id,
        screenname: user.screenname,
        emailHash:  user.emailHash,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const { safe } = await enforceContentSafety({
        userId:        metadata.userId,
        screenname:    metadata.screenname,
        emailHash:     metadata.emailHash,
        fileUrl:       file.url,
        fileKey:       file.key,
        mimeType:      file.type,
        fileSizeBytes: file.size,
      });

      if (!safe) throw new Error("upload failed");

      return { userId: metadata.userId, url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
