# Signoff Chat — Safety & CSAM Response Procedures

> **Legal obligation:** As an Electronic Service Provider (ESP) under 18 U.S.C. § 2258A,
> Signoff Chat must report apparent child sexual abuse material (CSAM) to the
> NCMEC CyberTipline **within 24 hours** of obtaining actual knowledge.

---

## 1. Detection Pipeline

Every file uploaded through UploadThing is automatically scanned before the URL
is returned to the app. Scans run in parallel using up to three providers:

| Provider | Type | Status |
|---|---|---|
| **Microsoft PhotoDNA** | Perceptual hash vs. NCMEC known-CSAM database | Pending access approval |
| **Thorn Safer** | ML + hash-based CSAM detection | Pending access approval |
| **AWS Rekognition** | General explicit-content classifier (moderation labels) | **Active — primary provider** |

**One UNSAFE result from any provider immediately:**
1. Preserves an encrypted evidence copy to S3 (Object Lock, 7-year COMPLIANCE)
2. Deletes the file from UploadThing storage
3. Permanently suspends the uploader account
4. Creates a `SafetyIncident` audit record
5. Queues an NCMEC CyberTipline report

> ⚠️ **Compliance gap (interim):** AWS Rekognition is NOT a CSAM detection tool.
> It is a general explicit-content classifier with no access to NCMEC's hash database.
> Content that does not appear explicitly sexual to Rekognition may not be caught.
> All flagged content is classified `CSAM_SUSPECTED` and reported conservatively.
> Apply for PhotoDNA: https://www.microsoft.com/en-us/photodna
> Apply for Thorn Safer: https://safer.io/

---

## 2. NCMEC CyberTipline Reporting

### Automated filing

`lib/safety/ncmec.ts` submits reports to `api.cybertipline.org/v2/reports/cybertip`
using HTTP Basic auth (credentials: `NCMEC_ESP_USERNAME`, `NCMEC_ESP_PASSWORD`).

A report is filed for **every** unsafe detection — including `CSAM_SUSPECTED` — because
Rekognition cannot distinguish CSAM from other harmful content, and under-reporting is
legally worse than over-reporting.

**Test environment:** Set `NCMEC_USE_TEST_ENV=true` to route to `testapi.cybertipline.org`.
Always test in the test environment before going live.

### Retry cron

`/api/cron/retry-ncmec-reports` runs hourly and retries any incident where the initial
NCMEC submission failed. Authorization: `Bearer CRON_SECRET`.

### Unreported-incident alert cron

`/api/cron/check-unreported-incidents` runs hourly and alerts the safety team if any
CSAM/CSAM_SUSPECTED incident is older than 6 hours without a report ID. This provides
an 18-hour buffer before the 24-hour statutory deadline.

### Manual filing (when automated pipeline fails)

If the automated pipeline is broken and a 24-hour deadline is approaching:

1. Visit https://www.cybertipline.org/ and log in with ESP credentials
2. File a report with: uploader screenname, content type, detection details, platform name
3. Record the CyberTipline report number
4. Update the `SafetyIncident` record manually:
   ```sql
   UPDATE safety_incidents
   SET ncmec_report_id = '<report-id>',
       ncmec_reported_at = NOW(),
       status = 'REPORTED_TO_NCMEC'
   WHERE id = '<incident-id>';
   ```
5. NCMEC phone: **1-800-843-5678**

---

## 3. Evidence Preservation

`lib/safety/preserve.ts` handles evidence storage:

- File is fetched from UploadThing **before** deletion
- SHA-256 hash is computed on plaintext bytes (stored as `contentHash`)
- File is encrypted with AES-256-GCM, key derived from `contentHash + EVIDENCE_ENCRYPTION_SECRET`
- Stored at `s3://${AWS_EVIDENCE_BUCKET}/evidence/<year>/<incidentId>.enc`
- Object Lock: **COMPLIANCE mode, 7-year retention** (cannot be deleted by anyone)

### Decrypting preserved evidence

Evidence may be requested by law enforcement with a valid legal process (subpoena, court order):

```ts
import { createDecipheriv, createHash } from "crypto";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3Key      = "<s3Key from SafetyIncident.preservedPath>";
const contentHash = "<contentHash from SafetyIncident.contentHash>";
const secret     = process.env.EVIDENCE_ENCRYPTION_SECRET!;

// Derive key
const key = createHash("sha256").update(contentHash + secret).digest();

// Download encrypted blob
const s3     = new S3Client({ /* credentials */ });
const obj    = await s3.send(new GetObjectCommand({ Bucket: process.env.AWS_EVIDENCE_BUCKET, Key: s3Key }));
const blob   = Buffer.from(await obj.Body!.transformToByteArray());

// Decrypt
const iv         = blob.subarray(0, 12);
const authTag    = blob.subarray(12, 28);
const ciphertext = blob.subarray(28);
const decipher   = createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(authTag);
const plaintext  = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
```

---

## 4. Account Suspension

When unsafe content is detected, the uploader account is **permanently suspended**:

```
isSuspended:    true
suspendedAt:    <now>
suspendedUntil: null   (permanent — null means no expiry)
suspendReason:  "CONTENT_SAFETY_VIOLATION"
```

The suspended account cannot log in and their sessions are invalidated on next request.
The account is **never** informed that a safety scan occurred or that a report was filed.

---

## 5. User Reports

Users can report content via `POST /api/reports` with `reason: "CSAM"`.

When a CSAM report is received:
1. A `Report` record is created (goes to staff review queue)
2. A `SafetyIncident` with `incidentType: USER_REPORT` is created
3. An immediate high-priority email is sent to `SAFETY_ALERT_EMAIL`
4. Staff reviews in the admin safety dashboard (`/safety`)
5. If confirmed, staff manually triggers NCMEC filing via the dashboard

---

## 6. Admin Safety Dashboard

URL: `/safety` (requires `isAdmin = true`)

The dashboard lists all `SafetyIncident` records with filter controls.

**Available actions:**

| Action | Effect |
|---|---|
| **Confirm** | Sets status to `CONFIRMED` — content reviewed and confirmed harmful |
| **Dismiss** | Sets status to `FALSE_POSITIVE` — reviewed and not harmful |
| **File NCMEC** | Manually triggers NCMEC CyberTipline report submission |
| **Resolve** | Sets status to `RESOLVED` — all required actions completed |

---

## 7. Environment Variables

| Variable | Purpose |
|---|---|
| `NCMEC_ESP_USERNAME` | NCMEC ESP API username |
| `NCMEC_ESP_PASSWORD` | NCMEC ESP API password |
| `NCMEC_ESP_NAME` | Your company name as registered with NCMEC |
| `NCMEC_USE_TEST_ENV` | Set to `"true"` to use `testapi.cybertipline.org` |
| `SAFETY_ALERT_EMAIL` | Internal email for incident alerts |
| `RESEND_API_KEY` | Resend API key for alert emails |
| `PHOTODNA_API_KEY` | Microsoft PhotoDNA subscription key (when available) |
| `THORN_SAFER_API_KEY` | Thorn Safer bearer token (when available) |
| `AWS_REKOGNITION_REGION` | Rekognition region (e.g. `us-east-1`) |
| `AWS_REKOGNITION_ACCESS_KEY_ID` | Rekognition AWS access key |
| `AWS_REKOGNITION_SECRET_ACCESS_KEY` | Rekognition AWS secret key |
| `AWS_EVIDENCE_BUCKET` | S3 bucket for encrypted evidence (Object Lock required) |
| `AWS_EVIDENCE_REGION` | Evidence S3 bucket region |
| `AWS_EVIDENCE_ACCESS_KEY_ID` | Evidence S3 AWS access key |
| `AWS_EVIDENCE_SECRET_ACCESS_KEY` | Evidence S3 AWS secret key |
| `EVIDENCE_ENCRYPTION_SECRET` | ≥32-char secret for AES-256-GCM key derivation |
| `CRON_SECRET` | Bearer token for cron job authorization |

---

## 8. Cron Schedule (Vercel / external scheduler)

```
# Retry failed NCMEC reports — every hour
0 * * * *  GET https://signoff.chat/api/cron/retry-ncmec-reports

# Alert on unreported CSAM incidents — every hour
0 * * * *  GET https://signoff.chat/api/cron/check-unreported-incidents
```

Both require `Authorization: Bearer <CRON_SECRET>` header.

---

## 9. Registering as an NCMEC ESP

Register your platform at:
https://www.missingkids.org/gethelpnow/cybertipline/esp

You will receive:
- `NCMEC_ESP_USERNAME` (your member ID)
- `NCMEC_ESP_PASSWORD`

Test your integration in the test environment (`NCMEC_USE_TEST_ENV=true`) before
going live.

---

## 10. Legal Contacts

- **NCMEC CyberTipline:** https://www.cybertipline.org/ | 1-800-843-5678
- **FBI Crimes Against Children:** https://www.fbi.gov/investigate/violent-crime/cac
- **Internet Crimes Against Children Task Force:** https://www.icactaskforce.org/

All incidents resulting in NCMEC reports should also be reviewed with legal counsel.
