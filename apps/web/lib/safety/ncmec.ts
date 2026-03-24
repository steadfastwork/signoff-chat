/**
 * NCMEC CyberTipline Reporting Pipeline
 *
 * Electronic service providers (ESPs) are required under 18 U.S.C. § 2258A
 * to report apparent violations of federal child sexual exploitation laws
 * to NCMEC's CyberTipline within 24 hours of obtaining actual knowledge.
 *
 * This module handles:
 *   1. Submitting CyberTipline reports via the NCMEC ESP API
 *   2. Sending an internal safety alert to the ops team
 *   3. Updating the SafetyIncident record with the report ID and status
 *
 * Required environment variables:
 *   NCMEC_ESP_USERNAME    — assigned by NCMEC when you register as an ESP
 *   NCMEC_ESP_PASSWORD    — assigned by NCMEC
 *   NCMEC_ESP_NAME        — your company name as registered with NCMEC (e.g. "Signoff Chat")
 *   SAFETY_ALERT_EMAIL    — internal address that receives CSAM incident alerts
 *   RESEND_API_KEY        — for sending the internal alert email
 *
 * Register your platform as an ESP at:
 *   https://www.missingkids.org/gethelpnow/cybertipline/esp
 *
 * NCMEC test environment:
 *   NCMEC_USE_TEST_ENV=true  → routes to https://testapi.cybertipline.org
 */

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NCMECReportInput {
  incidentId: string;   // SafetyIncident.id
  uploaderId: string | null;
  uploaderName: string;
  uploaderEmailHash: string;
  fileUrl: string;
  mimeType: string;
  incidentType: "CSAM" | "CSAM_SUSPECTED";
  provider: string;
  confidence: number;
  detectedAt: Date;
}

interface NCMECReportResponse {
  reportId: string;
  status: "SUBMITTED" | "FAILED";
  error?: string;
}

// ---------------------------------------------------------------------------
// NCMEC CyberTipline submission
// ---------------------------------------------------------------------------

const NCMEC_API_BASE = process.env.NCMEC_USE_TEST_ENV === "true"
  ? "https://testapi.cybertipline.org"
  : "https://api.cybertipline.org";

/**
 * Submit a report to the NCMEC CyberTipline.
 *
 * The API uses HTTP Basic authentication with ESP credentials.
 * The report body follows the NCMEC ESP API v2 schema.
 *
 * Returns the CyberTipline report ID on success; throws on failure.
 */
async function submitToNCMEC(input: NCMECReportInput): Promise<string> {
  const username = process.env.NCMEC_ESP_USERNAME;
  const password = process.env.NCMEC_ESP_PASSWORD;
  const espName  = process.env.NCMEC_ESP_NAME ?? "Signoff Chat";

  if (!username || !password) {
    throw new Error("NCMEC_ESP_USERNAME and NCMEC_ESP_PASSWORD are required");
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  // NCMEC ESP API v2 report body
  // https://www.missingkids.org/content/dam/missingkids/pdfs/ncmec-cybertipline-esp-api-guide.pdf
  const reportBody = {
    reportingESPName:        espName,
    reportingESPMemberId:    username,
    incidentDateTime:        input.detectedAt.toISOString(),
    reportType:              "CSAM",

    // Incident information
    violatingContent: {
      contentType: input.mimeType.startsWith("video/") ? "Video" : "Image",
      // URL of the offending file — deleted from storage before this is called,
      // but the original URL is recorded here per NCMEC requirements.
      fileUrl: input.fileUrl,
      uploadDateTime: input.detectedAt.toISOString(),
    },

    // Reporter information (Signoff Chat as the ESP)
    reporter: {
      firstName: espName,
      lastName:  "Safety Team",
      email:     process.env.SAFETY_ALERT_EMAIL ?? "",
    },

    // Uploader information — include what we have (no plaintext email per our privacy model)
    suspectInfo: {
      // screenname, not a real name — note this for NCMEC's context
      screenname:    input.uploaderName,
      espUserId:     input.uploaderId ?? "deleted-account",
      // emailHash is not the plaintext email — we note this clearly
      emailHashOnly: true,
      emailHash:     input.uploaderEmailHash,
    },

    // Technical details for investigators
    additionalInfo: [
      `Detection provider: ${input.provider}`,
      `Confidence: ${(input.confidence * 100).toFixed(1)}%`,
      `Incident type: ${input.incidentType}`,
      `Internal incident ID: ${input.incidentId}`,
      `Note: Email is stored as a one-way hash per platform privacy policy.`,
      `Note: Account has been permanently suspended.`,
    ].join("\n"),
  };

  const response = await fetch(`${NCMEC_API_BASE}/v2/reports/cybertip`, {
    method:  "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
    },
    body:    JSON.stringify(reportBody),
    signal:  AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`NCMEC API ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    reportId?: string;
    id?: string;
    status?: string;
  };

  const reportId = data.reportId ?? data.id;
  if (!reportId) {
    throw new Error(`NCMEC response missing reportId: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return reportId;
}

// ---------------------------------------------------------------------------
// Internal safety alert email
// ---------------------------------------------------------------------------

async function sendInternalAlert(input: NCMECReportInput, ncmecReportId: string | null): Promise<void> {
  const alertEmail = process.env.SAFETY_ALERT_EMAIL;
  const resendKey  = process.env.RESEND_API_KEY;

  if (!alertEmail || !resendKey) return;

  const resend = new Resend(resendKey);

  const subject = ncmecReportId
    ? `[CSAM INCIDENT] CyberTipline report filed — ${ncmecReportId}`
    : `[CSAM INCIDENT] NCMEC filing FAILED — manual action required`;

  const body = `
CSAM incident detected on Signoff Chat.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INCIDENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Incident ID:      ${input.incidentId}
Detected at:      ${input.detectedAt.toISOString()}
Incident type:    ${input.incidentType}
Provider:         ${input.provider}
Confidence:       ${(input.confidence * 100).toFixed(1)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPLOADER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User ID:          ${input.uploaderId ?? "unknown / account deleted"}
Screenname:       ${input.uploaderName}
Email hash:       ${input.uploaderEmailHash}
Account status:   PERMANENTLY SUSPENDED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MIME type:        ${input.mimeType}
Original URL:     ${input.fileUrl}
File status:      DELETED FROM STORAGE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NCMEC CYBERTIPLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Report ID:        ${ncmecReportId ?? "FILING FAILED — SEE BELOW"}
${!ncmecReportId ? `
⚠️  NCMEC filing failed. You must file manually within 24 hours.
    CyberTipline: https://www.cybertipline.org/
    Phone: 1-800-843-5678
    Incident log: safety_incidents table, id = ${input.incidentId}
` : "Report successfully filed with NCMEC CyberTipline."}

This message was generated automatically by the Signoff Chat safety pipeline.
Do not reply to this email.
`.trim();

  await resend.emails.send({
    from:    `safety@signoff.chat`,
    to:      alertEmail,
    subject,
    text:    body,
  });
}

// ---------------------------------------------------------------------------
// Public entry point — call this after a CSAM scan result
// ---------------------------------------------------------------------------

/**
 * File an NCMEC CyberTipline report and send an internal safety alert.
 *
 * - Updates the SafetyIncident record with ncmecReportId and status.
 * - Sends an internal email alert regardless of NCMEC outcome.
 * - If NCMEC filing fails, the incident is marked "FAILED" so it can be
 *   retried or filed manually within the 24-hour statutory window.
 *
 * This is fire-and-forget safe to call from the upload handler — errors
 * are caught and logged to the incident record rather than propagated.
 */
export async function fileNCMECReport(input: NCMECReportInput): Promise<void> {
  let ncmecReportId: string | null = null;
  let ncmecStatus: "SUBMITTED" | "FAILED" = "FAILED";
  let errorDetail: string | undefined;

  try {
    ncmecReportId = await submitToNCMEC(input);
    ncmecStatus   = "SUBMITTED";
  } catch (err) {
    errorDetail = err instanceof Error ? err.message : String(err);
    console.error("[SAFETY] NCMEC filing failed for incident", input.incidentId, errorDetail);
  }

  // Persist the NCMEC outcome to the incident record
  try {
    await prisma.safetyIncident.update({
      where: { id: input.incidentId },
      data: {
        ncmecReportId:   ncmecReportId,
        ncmecReportedAt: ncmecStatus === "SUBMITTED" ? new Date() : null,
        status:          ncmecStatus === "SUBMITTED" ? "REPORTED_TO_NCMEC" : undefined,
        actionsTaken:    ncmecStatus === "SUBMITTED"
          ? `FILE_DELETED,ACCOUNT_SUSPENDED,NCMEC_REPORTED:${ncmecReportId}`
          : `FILE_DELETED,ACCOUNT_SUSPENDED,NCMEC_FAILED:${errorDetail?.slice(0, 200)}`,
      },
    });
  } catch (dbErr) {
    console.error("[SAFETY] Failed to update incident record after NCMEC filing", dbErr);
  }

  // Send internal alert regardless of NCMEC outcome — ops need to know immediately
  await sendInternalAlert(input, ncmecReportId).catch((emailErr) => {
    console.error("[SAFETY] Failed to send internal alert email", emailErr);
  });
}

// ---------------------------------------------------------------------------
// Retry helper — for re-attempting failed NCMEC filings (e.g. cron job)
// ---------------------------------------------------------------------------

/**
 * Retry any SafetyIncident where ncmecStatus = "FAILED" and the incident
 * is a CSAM match older than 5 minutes (initial attempt may have just failed).
 * Safe to run on a schedule; idempotent if already SUBMITTED.
 */
export async function retryFailedNCMECReports(): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);

  const pending = await prisma.safetyIncident.findMany({
    where: {
      // Retry CSAM and CSAM_SUSPECTED — CSAM_SUSPECTED covers Rekognition hits
      // where hash-based confirmation wasn't available.
      incidentType: { in: ["CSAM", "CSAM_SUSPECTED"] },
      ncmecReportId: null,
      createdAt:    { lt: fiveMinutesAgo },
    },
  });

  for (const incident of pending) {
    await fileNCMECReport({
      incidentId:        incident.id,
      uploaderId:        incident.uploaderId,
      uploaderName:      incident.uploaderName,
      uploaderEmailHash: incident.uploaderEmailHash,
      fileUrl:           incident.contentUrl,
      mimeType:          incident.contentType,
      incidentType:      incident.incidentType as "CSAM" | "CSAM_SUSPECTED",
      provider:          incident.matchProvider ?? "unknown",
      confidence:        incident.matchConfidence ?? 0,
      detectedAt:        incident.scannedAt ?? incident.createdAt,
    });
  }
}
