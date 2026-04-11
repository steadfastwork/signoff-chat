import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptEmail } from "@/lib/emailEncryption";
import { internalError } from "@/lib/api-error";
import { Resend } from "resend";
import { render } from "@react-email/render";
import DigestEmail from "@/emails/DigestEmail";
import { SignJWT } from "jose";

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current HH:MM in the given IANA timezone.
 * Returns "00:00" if the timezone is invalid.
 */
function getUserLocalTime(timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return fmt.format(new Date());
  } catch {
    return "00:00"; // Invalid timezone → skip user
  }
}

/**
 * Format a Date as a readable time string for the email.
 * e.g. "9:14 AM"
 */
function formatTime(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }
}

/**
 * Format a Date as a readable date string for the email subject/header.
 * e.g. "Friday, March 27"
 */
function formatDate(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);
  }
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

async function run() {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = new Date();
  const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
  const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Fetch all digest-enabled users with encrypted emails
  const candidates = await prisma.user.findMany({
    where: {
      digestEnabled: true,
      emailEncrypted: { not: null },
      emailNonce: { not: null },
      // Only users who haven't received a digest in the last 23 hours
      OR: [
        { digestLastSentAt: null },
        { digestLastSentAt: { lt: twentyThreeHoursAgo } },
      ],
    },
    select: {
      id: true,
      screenname: true,
      emailEncrypted: true,
      emailNonce: true,
      digestTime: true,
      digestTimezone: true,
      digestLastSentAt: true,
    },
  });

  // Filter to users whose local time matches their digestTime right now
  const due = candidates.filter((user) => {
    const localTime = getUserLocalTime(user.digestTimezone);
    return localTime.slice(0, 5) === user.digestTime;
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of due) {
    try {
      // -----------------------------------------------------------------------
      // 1. Get accepted buddies
      // -----------------------------------------------------------------------
      const buddyRelations = await prisma.buddyRelation.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: user.id }, { addresseeId: user.id }],
        },
        select: { requesterId: true, addresseeId: true },
      });

      const buddyIds = buddyRelations.map((r) =>
        r.requesterId === user.id ? r.addresseeId : r.requesterId
      );

      // -----------------------------------------------------------------------
      // 2. Get away messages from buddies in the last 24h (PUBLIC or BUDDIES_ONLY)
      // -----------------------------------------------------------------------
      const awayMessages = await prisma.awayMessageHistory.findMany({
        where: {
          userId: { in: buddyIds },
          setAt: { gte: twentyFourHoursAgo },
          visibility: { in: ["PUBLIC", "BUDDIES"] },
        },
        orderBy: { setAt: "desc" },
        select: {
          content: true,
          setAt: true,
          user: { select: { screenname: true } },
        },
      });

      // -----------------------------------------------------------------------
      // 3. Skip if empty and last digest was within 25h (avoid empty spam)
      // -----------------------------------------------------------------------
      if (awayMessages.length === 0) {
        if (
          user.digestLastSentAt &&
          user.digestLastSentAt > twentyFiveHoursAgo
        ) {
          skipped++;
          continue;
        }
        // If it's been more than 25h, also skip — no point sending empty
        skipped++;
        continue;
      }

      // -----------------------------------------------------------------------
      // 4. Decrypt email
      // -----------------------------------------------------------------------
      const email = decryptEmail(user.emailEncrypted!, user.emailNonce!);

      // -----------------------------------------------------------------------
      // 5. Build template data
      // -----------------------------------------------------------------------
      const entries = awayMessages.map((m) => ({
        screenname: m.user.screenname,
        message: m.content,
        setAt: formatTime(m.setAt, user.digestTimezone),
      }));

      const date = formatDate(now, user.digestTimezone);

      // Generate unsubscribe JWT using jose (30 days)
      const jwtSecret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
      const token = await new SignJWT({ sub: user.id, type: "digest-unsub" })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(jwtSecret);

      const unsubscribeUrl = `${process.env.NEXTAUTH_URL}/api/digest/unsubscribe?token=${token}`;

      // -----------------------------------------------------------------------
      // 6. Render and send email
      // -----------------------------------------------------------------------
      const html = await render(
        DigestEmail({
          recipientScreenname: user.screenname,
          entries,
          unsubscribeUrl,
          date,
        })
      );

      await resend.emails.send({
        from: "Signoff Chat <digest@signoff.chat>",
        to: email,
        subject: `Your daily digest — ${date}`,
        html,
      });

      // -----------------------------------------------------------------------
      // 7. Update digestLastSentAt
      // -----------------------------------------------------------------------
      await prisma.user.update({
        where: { id: user.id },
        data: { digestLastSentAt: now },
      });

      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${user.id}] ${msg}`);
    }
  }

  // -----------------------------------------------------------------------
  // 8. Write CronLog
  // -----------------------------------------------------------------------
  await prisma.cronLog.create({
    data: {
      jobName: "send-digest",
      ranAt: now,
      success: errors.length === 0,
      message: `sent=${sent} skipped=${skipped} errors=${errors.length}${errors.length > 0 ? ` | ${errors.join("; ")}` : ""}`,
      durationMs: Date.now() - now.getTime(),
      triggeredBy: "cron",
    },
  });

  return { sent, skipped, errors, due: due.length, candidates: candidates.length };
}

// ---------------------------------------------------------------------------
// GET — invoked by Vercel Cron (every 30 minutes)
// POST — for manual / authenticated invocation
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "GET /api/cron/send-digest");
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "POST /api/cron/send-digest");
  }
}
