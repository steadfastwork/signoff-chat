import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validateScreenname, validatePassword } from "@/lib/auth";
import { gateway, GatewayError } from "@/lib/gateway";
import { getHashedIp } from "@/lib/crypto/ip";
import { rateLimit, limiters } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";

// SIGNOFF revival: registration creates an AIM/ICQ account on open-oscar-server
// (the canonical identity store) via the gateway, then a Postgres mirror row.
// No email — this is a retro IM account, screenname + password only.
export async function POST(req: NextRequest) {
  const hashedIp = getHashedIp(req.headers);
  const rl = await rateLimit(limiters.auth, `auth:h:${hashedIp}`);
  if (rl) return rl;

  try {
    const body = await req.json();
    const { screenname, password, turnstileToken } = body as {
      screenname?: string;
      password?: string;
      turnstileToken?: string;
    };

    const captchaOk = await verifyTurnstile(turnstileToken ?? "");
    if (!captchaOk) {
      return NextResponse.json({ error: "CAPTCHA verification failed. Please try again." }, { status: 400 });
    }

    const screennameError = validateScreenname(screenname ?? "");
    if (screennameError) return NextResponse.json({ error: screennameError }, { status: 400 });

    const passwordError = validatePassword(password ?? "");
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    // Fast pre-check against the mirror (case-insensitive).
    const existing = await prisma.user.findFirst({
      where: { screenname: { equals: screenname, mode: "insensitive" } },
      select: { screenname: true },
    });
    if (existing) return NextResponse.json({ error: "screenname taken. try another." }, { status: 409 });

    // Create on OSCAR first (authoritative). 409 there = taken on the server.
    try {
      await gateway.register(screenname!, password!);
    } catch (e) {
      if (e instanceof GatewayError && e.status === 409) {
        return NextResponse.json({ error: "screenname taken. try another." }, { status: 409 });
      }
      throw e;
    }

    // Mirror row for the app's relational data. passwordHash is stored for
    // continuity only; OSCAR remains authoritative.
    const user = await prisma.user.create({
      data: {
        screenname: screenname!,
        passwordHash: await bcrypt.hash(password!, 12),
        emailHash: null,
        emailVerified: new Date(),
        onboardingComplete: true,
      },
      select: { id: true, screenname: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("[AUTH REGISTER]", err);
    return NextResponse.json({ error: "something went wrong. try again." }, { status: 500 });
  }
}
