/**
 * Upload Scanning Pipeline — CSAM & Harmful Content Detection
 *
 * Runs BEFORE any media URL is returned to the app or stored anywhere
 * that users can access. Three providers are used in priority order:
 *
 *   1. Microsoft PhotoDNA Cloud Service  (primary — perceptual hash vs. CSAM DB)
 *   2. Thorn Safer API                   (secondary — ML + hash-based CSAM detection)
 *   3. AWS Rekognition                   (tertiary — always-on moderation baseline)
 *
 * A single UNSAFE result from ANY provider marks the upload as unsafe.
 * All three are attempted regardless so results can be cross-referenced in
 * the audit log (SafetyIncident.allProviders).
 *
 * Required environment variables:
 *   PHOTODNA_API_KEY            — Microsoft Awareness API subscription key
 *   THORN_SAFER_API_KEY         — Thorn Safer bearer token
 *   AWS_REKOGNITION_REGION      — e.g. "us-east-1"
 *   AWS_REKOGNITION_ACCESS_KEY_ID
 *   AWS_REKOGNITION_SECRET_ACCESS_KEY
 *
 * PhotoDNA and Thorn Safer require approval before keys are issued.
 * Rekognition runs unconditionally as the always-on baseline.
 * If a provider key is missing the provider is skipped (not failed).
 */

import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from "@aws-sdk/client-rekognition";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ProviderResult {
  provider: string;
  safe: boolean;
  matchType: "CSAM" | "KNOWN_HARMFUL" | "CLEAN";
  confidence: number; // 0.0 – 1.0
  detail?: string;
}

export interface ScanResult {
  safe: boolean;
  matchType: "CSAM" | "KNOWN_HARMFUL" | "CLEAN";
  confidence: number;
  provider: string; // primary triggering provider, or "multi" if several flagged
  allProviders: ProviderResult[];
  scannedAt: Date;
}

// ---------------------------------------------------------------------------
// Main scan entry point
// ---------------------------------------------------------------------------

/**
 * Scan a file buffer for CSAM and other harmful content.
 *
 * @param fileBuffer  Raw file bytes (max 10 MB for Rekognition; others accept larger)
 * @param mimeType    MIME type of the file (e.g. "image/jpeg")
 * @param uploadId    Internal reference for log correlation
 */
export async function scanUpload(
  fileBuffer: Buffer,
  mimeType: string,
  uploadId: string
): Promise<ScanResult> {
  const scannedAt = new Date();

  const [photoDNAResult, thornResult, rekognitionResult] = await Promise.allSettled([
    scanWithPhotoDNA(fileBuffer, mimeType, uploadId),
    scanWithThornSafer(fileBuffer, mimeType, uploadId),
    scanWithRekognition(fileBuffer, mimeType, uploadId),
  ]);

  const results: ProviderResult[] = [];
  for (const r of [photoDNAResult, thornResult, rekognitionResult]) {
    if (r.status === "fulfilled") results.push(r.value);
    // Rejected = provider unavailable/misconfigured — do not count as safe or unsafe
  }

  // If no provider ran successfully, fail safe (block the upload).
  // At minimum Rekognition must succeed; if it throws, something is wrong.
  if (results.length === 0) {
    return {
      safe: false,
      matchType: "KNOWN_HARMFUL",
      confidence: 1.0,
      provider: "NO_PROVIDERS_AVAILABLE",
      allProviders: [],
      scannedAt,
    };
  }

  const unsafe = results.filter((r) => !r.safe);

  if (unsafe.length === 0) {
    return {
      safe: true,
      matchType: "CLEAN",
      confidence: 1.0,
      provider: results.map((r) => r.provider).join(","),
      allProviders: results,
      scannedAt,
    };
  }

  // CSAM takes precedence over KNOWN_HARMFUL
  const csamHits = unsafe.filter((r) => r.matchType === "CSAM");
  const matchType = csamHits.length > 0 ? "CSAM" : "KNOWN_HARMFUL";
  const triggering = csamHits.length > 0 ? csamHits : unsafe;
  const maxConfidence = Math.max(...triggering.map((r) => r.confidence));
  const primaryProvider =
    triggering.length === 1 ? triggering[0].provider : "multi";

  return {
    safe: false,
    matchType,
    confidence: maxConfidence,
    provider: primaryProvider,
    allProviders: results,
    scannedAt,
  };
}

// ---------------------------------------------------------------------------
// Provider A — Microsoft PhotoDNA Cloud Service
// https://www.microsoft.com/en-us/photodna
//
// Perceptual hash matching against NCMEC's known CSAM hash database.
// Most accurate provider — primary detection layer.
//
// Access: https://azure.microsoft.com/en-us/products/cognitive-services/content-safety
// API: https://api.microsoftawareness.com/photodna/hashing
// ---------------------------------------------------------------------------

async function scanWithPhotoDNA(
  fileBuffer: Buffer,
  mimeType: string,
  _uploadId: string
): Promise<ProviderResult> {
  const apiKey = process.env.PHOTODNA_API_KEY;
  if (!apiKey) {
    // Key not configured — skip this provider silently
    throw new Error("PhotoDNA API key not configured");
  }

  const form = new FormData();
  const blob = new Blob([fileBuffer.buffer as ArrayBuffer], { type: mimeType });
  form.append("file", blob, "upload");

  const response = await fetch(
    "https://api.microsoftawareness.com/photodna/hashing",
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      body: form,
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`PhotoDNA HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    IsMatch: boolean;
    MatchDetails?: { MatchConfidence?: number };
    Status?: { Code?: number; Description?: string };
  };

  if (data.IsMatch) {
    return {
      provider: "PhotoDNA",
      safe: false,
      matchType: "CSAM",
      confidence: (data.MatchDetails?.MatchConfidence ?? 100) / 100,
      detail: "PhotoDNA hash match against NCMEC known-CSAM database",
    };
  }

  return {
    provider: "PhotoDNA",
    safe: true,
    matchType: "CLEAN",
    confidence: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Provider B — Thorn Safer
// https://www.thorn.org/safer
//
// ML-based CSAM detection. Requires approval + commercial agreement.
// Access: https://safer.io/
// ---------------------------------------------------------------------------

async function scanWithThornSafer(
  fileBuffer: Buffer,
  mimeType: string,
  uploadId: string
): Promise<ProviderResult> {
  const apiKey = process.env.THORN_SAFER_API_KEY;
  if (!apiKey) {
    throw new Error("Thorn Safer API key not configured");
  }

  const form = new FormData();
  const blob = new Blob([fileBuffer.buffer as ArrayBuffer], { type: mimeType });
  form.append("media", blob, "upload");
  form.append("externalId", uploadId);

  const response = await fetch("https://api.safer.io/v1/media/scan", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ThornSafer HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    result: "safe" | "unsafe" | "review";
    classifications?: { csam?: number; explicit?: number };
    confidence?: number;
  };

  if (data.result === "unsafe") {
    const csamScore = data.classifications?.csam ?? 0;
    const explicitScore = data.classifications?.explicit ?? 0;
    const isCSAM = csamScore > 0.5;

    return {
      provider: "ThornSafer",
      safe: false,
      matchType: isCSAM ? "CSAM" : "KNOWN_HARMFUL",
      confidence: Math.max(csamScore, explicitScore, data.confidence ?? 0),
      detail: `ThornSafer unsafe: csam=${csamScore.toFixed(3)}, explicit=${explicitScore.toFixed(3)}`,
    };
  }

  // "review" — treat as safe but note it; human review queue can handle flagged uploads
  return {
    provider: "ThornSafer",
    safe: true,
    matchType: "CLEAN",
    confidence: 1.0,
    detail: data.result === "review" ? "flagged for human review" : undefined,
  };
}

// ---------------------------------------------------------------------------
// Provider C — AWS Rekognition  (currently the ONLY active provider)
//
// ⚠️  COMPLIANCE GAP — READ THIS:
//
// Rekognition DetectModerationLabels is a general explicit-content classifier.
// It is NOT a CSAM detection tool. It has no access to NCMEC's hash database
// of known child sexual abuse material. Content that does not appear explicitly
// sexual to Rekognition's classifier — including some categories of CSAM — will
// NOT be caught here.
//
// This is an interim measure while PhotoDNA / Thorn Safer access is pending.
// Apply for PhotoDNA at: https://www.microsoft.com/en-us/photodna
// Apply for Thorn Safer at: https://safer.io/
//
// Until hash-based scanning is in place:
//   • All explicit/sexual content is blocked (reduces CSAM surface area)
//   • Video uploads are BLOCKED entirely (Rekognition image API cannot scan video)
//   • Every flagged upload still creates a SafetyIncident audit record
//   • NCMEC CyberTipline reports are filed for anything classified KNOWN_HARMFUL
//     (conservative — better to over-report than under-report)
//
// Required env vars:
//   AWS_REKOGNITION_REGION              (e.g. "us-east-1")
//   AWS_REKOGNITION_ACCESS_KEY_ID
//   AWS_REKOGNITION_SECRET_ACCESS_KEY
// ---------------------------------------------------------------------------

// All Rekognition top-level and parent labels that indicate sexual content.
// Using the broadest possible set because false positives are acceptable —
// false negatives are not.
const REKOGNITION_UNSAFE_LABELS = new Set([
  // Top-level categories
  "Explicit Nudity",
  "Suggestive",
  // Explicit nudity sub-labels
  "Nudity",
  "Graphic Male Nudity",
  "Graphic Female Nudity",
  "Sexual Activity",
  "Explicit Sexual Activity",
  "Sex Toys",
  // Suggestive sub-labels (lower confidence needed — err on side of caution)
  "Sexual Situations",
  "Partial Nudity",
  "Revealing Clothes",
  "Barechested Male",
]);

// Confidence threshold kept low intentionally.
// A false positive costs one upload rejection. A false negative may cost a child.
const REKOGNITION_MIN_CONFIDENCE = 60;

// Sub-labels that warrant a lower per-label threshold because they are more
// specifically indicative of content that could involve minors.
const REKOGNITION_HIGH_SENSITIVITY_LABELS = new Set([
  "Explicit Sexual Activity",
  "Sexual Activity",
  "Sexual Situations",
]);
const REKOGNITION_HIGH_SENSITIVITY_CONFIDENCE = 50;

async function scanWithRekognition(
  fileBuffer: Buffer,
  mimeType: string,
  _uploadId: string
): Promise<ProviderResult> {
  // VIDEO: Rekognition's image API cannot scan video frames.
  // Block all video uploads until Rekognition Video (async, S3-based) or a
  // dedicated provider is wired up. This is intentionally conservative.
  if (mimeType.startsWith("video/")) {
    return {
      provider:  "Rekognition",
      safe:      false,
      matchType: "KNOWN_HARMFUL",
      confidence: 1.0,
      detail:    "Video uploads are disabled pending video scanning implementation.",
    };
  }

  if (!mimeType.startsWith("image/")) {
    // GIF, unknown — treat as image path; Rekognition will handle or reject it.
    // Fall through rather than auto-approve unknown types.
  }

  const region          = process.env.AWS_REKOGNITION_REGION;
  const accessKeyId     = process.env.AWS_REKOGNITION_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_REKOGNITION_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("AWS Rekognition credentials not configured");
  }

  const client = new RekognitionClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const command = new DetectModerationLabelsCommand({
    Image: { Bytes: fileBuffer },
    // Ask for the full label set — we filter by confidence below, not here.
    MinConfidence: REKOGNITION_HIGH_SENSITIVITY_CONFIDENCE,
  });

  const response = await client.send(command);
  const labels   = response.ModerationLabels ?? [];

  const flaggedLabels = labels.filter((l) => {
    if (!l.Name) return false;
    if (!REKOGNITION_UNSAFE_LABELS.has(l.Name)) return false;
    const threshold = REKOGNITION_HIGH_SENSITIVITY_LABELS.has(l.Name)
      ? REKOGNITION_HIGH_SENSITIVITY_CONFIDENCE
      : REKOGNITION_MIN_CONFIDENCE;
    return (l.Confidence ?? 0) >= threshold;
  });

  if (flaggedLabels.length === 0) {
    return { provider: "Rekognition", safe: true, matchType: "CLEAN", confidence: 1.0 };
  }

  const maxConfidence = Math.max(...flaggedLabels.map((l) => l.Confidence ?? 0)) / 100;
  const names         = flaggedLabels.map((l) => `${l.Name}(${(l.Confidence ?? 0).toFixed(0)}%)`).join(", ");

  return {
    provider:  "Rekognition",
    safe:      false,
    // Cannot confirm CSAM — Rekognition has no hash-based CSAM detection.
    // Classify as KNOWN_HARMFUL; NCMEC report is still filed (conservative).
    matchType: "KNOWN_HARMFUL",
    confidence: maxConfidence,
    detail:    `Rekognition flagged: ${names}`,
  };
}
