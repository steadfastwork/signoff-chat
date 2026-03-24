/**
 * Cron: Check for unreported CSAM incidents
 *
 * Runs hourly. Finds CSAM/CSAM_SUSPECTED incidents older than 6 hours
 * that do not yet have an NCMEC report ID filed. Sends an immediate alert
 * to the safety team so they can investigate and file manually if needed.
 *
 * 18 U.S.C. § 2258A requires ESPs to file NCMEC CyberTipline reports
 * within 24 hours of obtaining actual knowledge. This cron provides an
 * early-warning buffer at 6 hours, giving 18 hours of response time.
 *
 * Authorization: Bearer CRON_SECRET header (same pattern as other cron routes).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { internalError } from "@/lib/api-error";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function run() {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60_000);

  const unreported = await prisma.safetyIncident.findMany({
    where: {
      incidentType:  { in: ["CSAM", "CSAM_SUSPECTED"] },
      ncmecReportId: null,
      createdAt:     { lt: sixHoursAgo },
      // Don't alert for dismissed false positives
      status:        { notIn: ["FALSE_POSITIVE", "RESOLVED"] },
    },
    select: {
      id:           true,
      createdAt:    true,
      incidentType: true,
      status:       true,
      uploaderName: true,
      contentUrl:   true,
      matchProvider: true,
      matchConfidence: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (unreported.length === 0) {
    return { ok: true, unreportedCount: 0, ranAt: new Date().toISOString() };
  }

  // Send alert email
  const alertEmail = process.env.SAFETY_ALERT_EMAIL;
  const resendKey  = process.env.RESEND_API_KEY;

  if (alertEmail && resendKey) {
    const resend = new Resend(resendKey);

    const incidentLines = unreported.map((inc) => {
      const age = Math.round((Date.now() - new Date(inc.createdAt).getTime()) / 3_600_000);
      return [
        `  ID:       ${inc.id}`,
        `  Type:     ${inc.incidentType}`,
        `  Status:   ${inc.status}`,
        `  Uploader: ${inc.uploaderName}`,
        `  Age:      ~${age}h`,
        `  URL:      ${inc.contentUrl}`,
      ].join("\n");
    }).join("\n\n");

    await resend.emails.send({
      from:    "safety@signoff.chat",
      to:      alertEmail,
      subject: `[SAFETY ALERT] ${unreported.length} CSAM incident(s) without NCMEC report — action required`,
      text: `
⚠️  UNREPORTED CSAM INCIDENTS — IMMEDIATE ACTION REQUIRED

${unreported.length} incident(s) are older than 6 hours without an NCMEC CyberTipline report.

Under 18 U.S.C. § 2258A, reports must be filed within 24 hours.
You have approximately ${24 - 6} hours of remaining statutory window for the oldest incident.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNREPORTED INCIDENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${incidentLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Log in to the admin safety dashboard
2. Review each incident
3. File NCMEC CyberTipline reports for confirmed CSAM
4. Dismiss false positives

If the automated pipeline is broken:
  CyberTipline: https://www.cybertipline.org/
  Phone: 1-800-843-5678

This alert was generated automatically by the Signoff Chat safety pipeline.
`.trim(),
      headers: { "X-Priority": "1", "Importance": "high" },
    }).catch((emailErr) => {
      console.error("[check-unreported] Failed to send alert email:", emailErr);
    });
  } else {
    console.error("[check-unreported] SAFETY_ALERT_EMAIL or RESEND_API_KEY not configured — cannot send alert for unreported incidents");
  }

  console.warn(`[check-unreported] ALERT: ${unreported.length} CSAM incident(s) without NCMEC report:`, unreported.map(i => i.id));

  return {
    ok:              true,
    unreportedCount: unreported.length,
    incidentIds:     unreported.map((i) => i.id),
    ranAt:           new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "GET /api/cron/check-unreported-incidents");
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "POST /api/cron/check-unreported-incidents");
  }
}
