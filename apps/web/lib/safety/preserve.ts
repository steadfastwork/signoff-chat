/**
 * Evidence Preservation Pipeline
 *
 * Stores an AES-256-GCM encrypted copy of flagged content in a private S3
 * bucket with Object Lock enabled (COMPLIANCE mode, 7-year retention).
 *
 * Legal requirement: ESPs must retain evidence for any incident that results
 * in an NCMEC CyberTipline report. 18 U.S.C. § 2258A(h) requires a 90-day
 * hold; we use 7 years to match standard legal discovery windows.
 *
 * The encryption key is the SHA-256 hash of the file bytes XOR'd with a
 * server-side secret (EVIDENCE_ENCRYPTION_SECRET). This means:
 *   • The key cannot be derived without the server secret
 *   • Files with identical content produce different ciphertext (due to random IV)
 *
 * Required environment variables:
 *   AWS_EVIDENCE_BUCKET             — S3 bucket with Object Lock enabled
 *   AWS_EVIDENCE_REGION             — e.g. "us-east-1"
 *   AWS_EVIDENCE_ACCESS_KEY_ID
 *   AWS_EVIDENCE_SECRET_ACCESS_KEY
 *   EVIDENCE_ENCRYPTION_SECRET      — 64-char hex string (32 bytes)
 *
 * S3 bucket requirements:
 *   • Object Lock enabled (COMPLIANCE mode)
 *   • Default retention: 7 years
 *   • Versioning enabled (required for Object Lock)
 *   • Block all public access
 *   • Server-side encryption (SSE-S3 or SSE-KMS) as second layer
 */

import {
  S3Client,
  PutObjectCommand,
  ObjectLockRetentionMode,
} from "@aws-sdk/client-s3";
import { createCipheriv, createHash, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreserveResult {
  s3Key:       string;   // S3 object key where evidence is stored
  contentHash: string;   // SHA-256 hex of the original (unencrypted) bytes
  preservedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getS3Client(): S3Client {
  const region      = process.env.AWS_EVIDENCE_REGION;
  const accessKeyId = process.env.AWS_EVIDENCE_ACCESS_KEY_ID;
  const secretKey   = process.env.AWS_EVIDENCE_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretKey) {
    throw new Error("AWS evidence bucket credentials not configured");
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey: secretKey },
  });
}

/**
 * Derive the AES-256 encryption key for this file.
 * key = SHA-256( fileHash || EVIDENCE_ENCRYPTION_SECRET )
 */
function deriveEncryptionKey(contentHash: string): Buffer {
  const secret = process.env.EVIDENCE_ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("EVIDENCE_ENCRYPTION_SECRET must be at least 32 characters");
  }
  return createHash("sha256")
    .update(contentHash + secret)
    .digest();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Download a file from UploadThing CDN, compute its SHA-256 hash,
 * encrypt it with AES-256-GCM, and store it in the evidence S3 bucket
 * with a 7-year COMPLIANCE Object Lock retention.
 *
 * The stored object format:
 *   [ 12-byte IV ][ 16-byte GCM auth tag ][ ciphertext ]
 *
 * @param fileUrl       Original UploadThing URL
 * @param incidentId    SafetyIncident.id (used as part of the S3 key)
 * @param contentType   MIME type (stored as S3 object Content-Type metadata)
 */
export async function preserveEvidence(
  fileUrl:     string,
  incidentId:  string,
  contentType: string
): Promise<PreserveResult> {
  const bucket = process.env.AWS_EVIDENCE_BUCKET;
  if (!bucket) throw new Error("AWS_EVIDENCE_BUCKET not configured");

  // 1. Fetch the file
  const fetchRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30_000) });
  if (!fetchRes.ok) {
    throw new Error(`Failed to fetch file for preservation: HTTP ${fetchRes.status}`);
  }
  const fileBytes = Buffer.from(await fetchRes.arrayBuffer());

  // 2. Hash the plaintext
  const contentHash = createHash("sha256").update(fileBytes).digest("hex");

  // 3. Encrypt with AES-256-GCM
  const iv         = randomBytes(12);           // 96-bit IV (GCM standard)
  const key        = deriveEncryptionKey(contentHash);
  const cipher     = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(fileBytes), cipher.final()]);
  const authTag    = cipher.getAuthTag();        // 16 bytes

  // Stored blob: IV || authTag || ciphertext
  const encrypted = Buffer.concat([iv, authTag, ciphertext]);

  // 4. Upload to S3 with Object Lock
  const preservedAt = new Date();
  // 7-year retention from now
  const retainUntil = new Date(preservedAt.getTime() + 7 * 365.25 * 24 * 60 * 60 * 1000);

  const s3Key = `evidence/${preservedAt.getFullYear()}/${incidentId}.enc`;

  const s3 = getS3Client();
  await s3.send(new PutObjectCommand({
    Bucket:             bucket,
    Key:                s3Key,
    Body:               encrypted,
    ContentType:        "application/octet-stream",
    Metadata: {
      "x-incident-id":   incidentId,
      "x-content-type":  contentType,
      "x-content-hash":  contentHash,
      "x-preserved-at":  preservedAt.toISOString(),
    },
    // Object Lock — COMPLIANCE mode prevents deletion even by bucket owner
    ObjectLockMode:            ObjectLockRetentionMode.COMPLIANCE,
    ObjectLockRetainUntilDate: retainUntil,
  }));

  return { s3Key, contentHash, preservedAt };
}
