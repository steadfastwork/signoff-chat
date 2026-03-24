import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { fileNCMECReport } from "@/lib/safety/ncmec";

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// POST /api/reports
// Submit a report. CSAM triggers an immediate out-of-band email alert.
// All others go into the PENDING queue for staff review.
//
// Body: {
//   targetType: "user" | "post" | "message",
//   targetId: string,
//   reason: ReportReason,
//   detail?: string,
// }
// ---------------------------------------------------------------------------

const VALID_REASONS = ["SPAM", "HARASSMENT", "CSAM", "THREAT", "IMPERSONATION", "OTHER"] as const;
type ReportReason = typeof VALID_REASONS[number];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json." }, { status: 400 });
  }

  const { targetType, targetId, reason, detail } = body as Record<string, string>;

  if (!targetType || !targetId || !reason) {
    return NextResponse.json({ error: "targetType, targetId, and reason are required." }, { status: 400 });
  }

  if (!VALID_REASONS.includes(reason as ReportReason)) {
    return NextResponse.json({ error: "invalid reason." }, { status: 400 });
  }

  if (!["user", "post", "message"].includes(targetType)) {
    return NextResponse.json({ error: "invalid targetType." }, { status: 400 });
  }

  // Build the targeted field
  const targetFields: {
    targetUserId?: string;
    targetPostId?: string;
    targetMsgId?: string;
  } = {};

  if (targetType === "user")    targetFields.targetUserId = targetId;
  if (targetType === "post")    targetFields.targetPostId = targetId;
  if (targetType === "message") targetFields.targetMsgId  = targetId;

  // Create the report
  const report = await prisma.report.create({
    data: {
      reporterId: session.user.id,
      ...targetFields,
      reason: reason as ReportReason,
      detail: detail?.slice(0, 500) ?? null,
    },
  });

  // ── CSAM: create SafetyIncident + immediate alert ─────────────────────────
  // Filed as USER_REPORT (human-reported, not scanner-detected).
  // Staff must review and confirm before NCMEC report is filed.
  if (reason === "CSAM") {
    try {
      // Resolve uploader identity for the target content
      let uploaderName = "unknown";
      let uploaderEmailHash = "";
      let uploaderId: string | null = null;
      let contentType = "unknown";

      if (targetType === "post") {
        const post = await prisma.post.findUnique({
          where: { id: targetId },
          select: { authorId: true, author: { select: { screenname: true, emailHash: true } }, mediaType: true },
        });
        if (post) {
          uploaderId       = post.authorId;
          uploaderName     = post.author.screenname;
          uploaderEmailHash = post.author.emailHash;
          contentType      = post.mediaType ? `media/${post.mediaType.toLowerCase()}` : "text/post";
        }
      } else if (targetType === "message") {
        const msg = await prisma.channelMessage.findUnique({
          where: { id: targetId },
          select: { authorId: true, author: { select: { screenname: true, emailHash: true } }, mediaType: true },
        });
        if (msg) {
          uploaderId        = msg.authorId;
          uploaderName      = msg.author.screenname;
          uploaderEmailHash = msg.author.emailHash;
          contentType       = msg.mediaType ? `media/${msg.mediaType.toLowerCase()}` : "text/message";
        }
      } else if (targetType === "user") {
        const u = await prisma.user.findUnique({
          where: { id: targetId },
          select: { screenname: true, emailHash: true },
        });
        if (u) {
          uploaderId        = targetId;
          uploaderName      = u.screenname;
          uploaderEmailHash = u.emailHash;
          contentType       = "user/profile";
        }
      }

      // Create the SafetyIncident — status DETECTED, pending staff review
      await prisma.safetyIncident.create({
        data: {
          incidentType:      "USER_REPORT" as any,
          status:            "DETECTED" as any,
          reporterId:        session.user.id,
          uploaderId,
          uploaderName,
          uploaderEmailHash,
          contentUrl:        `internal://${targetType}/${targetId}`,
          fileKey:           `${targetType}:${targetId}`,
          contentType,
          actionsTaken:      `USER_REPORTED:${report.id}`,
          internalNotes:     detail ? `Reporter note: ${detail}` : null,
        },
      });
    } catch (err) {
      console.error("[reports] Failed to create SafetyIncident for CSAM report:", err);
    }

    // Send immediate email alert to ops
    try {
      await resend.emails.send({
        from:    "safety@signoff.chat",
        to:      process.env.SAFETY_ALERT_EMAIL ?? "abuse@signoff.chat",
        subject: `[URGENT] User-reported CSAM — ${report.id}`,
        text: [
          "USER-REPORTED CSAM — IMMEDIATE REVIEW REQUIRED",
          "",
          `Report ID:   ${report.id}`,
          `Target type: ${targetType}`,
          `Target ID:   ${targetId}`,
          `Reporter:    ${session.user.id} (@${(session.user as any).screenname ?? "?"})`,
          "",
          detail ? `Details: ${detail}` : "(no additional detail provided)",
          "",
          "Review in the admin safety dashboard and confirm or dismiss.",
          "If confirmed, file NCMEC CyberTipline report within 24 hours.",
        ].join("\n"),
        headers: { "X-Priority": "1", "Importance": "high" },
      });
    } catch (err) {
      console.error("[reports] CSAM email alert failed:", err);
    }
  }

  return NextResponse.json({ reported: true, reportId: report.id }, { status: 201 });
}
