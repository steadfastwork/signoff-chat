import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { internalError } from "@/lib/api-error";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Validate "HH:MM" 24h format, 30-minute intervals */
function isValidDigestTime(time: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return false;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23) return false;
  if (m !== 0 && m !== 30) return false;
  return true;
}

/** Validate an IANA timezone string via Intl */
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GET /api/user/digest
// Returns { digestEnabled, digestTime, digestTimezone, hasEmail }
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        digestEnabled: true,
        digestTime: true,
        digestTimezone: true,
        emailEncrypted: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    return NextResponse.json({
      digestEnabled: user.digestEnabled,
      digestTime: user.digestTime,
      digestTimezone: user.digestTimezone,
      hasEmail: !!user.emailEncrypted,
    });
  } catch (err) {
    return internalError(err, "GET /api/user/digest");
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/user/digest
// Body: { digestEnabled?, digestTime?, digestTimezone? }
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { digestEnabled?: unknown; digestTime?: unknown; digestTimezone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body." }, { status: 400 });
  }

  const update: {
    digestEnabled?: boolean;
    digestTime?: string;
    digestTimezone?: string;
  } = {};

  if (body.digestEnabled !== undefined) {
    if (typeof body.digestEnabled !== "boolean") {
      return NextResponse.json({ error: "digestEnabled must be a boolean." }, { status: 400 });
    }
    update.digestEnabled = body.digestEnabled;
  }

  if (body.digestTime !== undefined) {
    if (typeof body.digestTime !== "string" || !isValidDigestTime(body.digestTime)) {
      return NextResponse.json(
        { error: "digestTime must be HH:MM (30-minute intervals, e.g. '09:00' or '14:30')." },
        { status: 400 }
      );
    }
    update.digestTime = body.digestTime;
  }

  if (body.digestTimezone !== undefined) {
    if (typeof body.digestTimezone !== "string" || !isValidTimezone(body.digestTimezone)) {
      return NextResponse.json(
        { error: "digestTimezone must be a valid IANA timezone string." },
        { status: 400 }
      );
    }
    update.digestTimezone = body.digestTimezone;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no valid fields to update." }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: update,
      select: {
        digestEnabled: true,
        digestTime: true,
        digestTimezone: true,
        emailEncrypted: true,
      },
    });

    return NextResponse.json({
      digestEnabled: user.digestEnabled,
      digestTime: user.digestTime,
      digestTimezone: user.digestTimezone,
      hasEmail: !!user.emailEncrypted,
    });
  } catch (err) {
    return internalError(err, "PATCH /api/user/digest");
  }
}
