import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

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

  // ── CSAM: immediate high-priority email alert ──────────────────────────────
  // Sent out-of-band from the normal review queue.
  // Deliberately brief — include only what staff need to act immediately.
  if (reason === "CSAM") {
    try {
      await resend.emails.send({
        from:    "alerts@signoffchat.com",
        to:      "abuse@signoffchat.com",
        subject: `[URGENT] CSAM report — ${report.id}`,
        text: [
          "CSAM REPORT — IMMEDIATE ACTION REQUIRED",
          "",
          `Report ID:   ${report.id}`,
          `Target type: ${targetType}`,
          `Target ID:   ${targetId}`,
          `Reporter:    ${session.user.id} (@${session.user.screenname})`,
          "",
          detail ? `Details: ${detail}` : "(no additional detail provided)",
          "",
          "Log in to the admin panel to review and action this report.",
        ].join("\n"),
        headers: {
          "X-Priority": "1",
          "Importance": "high",
        },
      });
    } catch (err) {
      // Log but don't fail the request — report is already in DB
      console.error("[reports] CSAM email alert failed:", err);
    }
  }

  return NextResponse.json({ reported: true, reportId: report.id }, { status: 201 });
}
