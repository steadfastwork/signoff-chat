import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateScreenname, validatePassword, hashPassword } from "@/lib/auth";
import { hashEmail } from "@/lib/crypto/email";
import { getHashedIp } from "@/lib/crypto/ip";
import { rateLimit, limiters } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  // Rate limit — hash IP immediately, never store the raw value
  const hashedIp = getHashedIp(req.headers);
  const rl = await rateLimit(limiters.auth, `auth:h:${hashedIp}`);
  if (rl) return rl;

  try {
    const body = await req.json();
    const { screenname, email, password, mlkemPublicKey } = body as {
      screenname?: string;
      email?: string;
      password?: string;
      mlkemPublicKey?: string;
    };

    // --- Validate screenname ---
    const screennameError = validateScreenname(screenname ?? "");
    if (screennameError) {
      return NextResponse.json({ error: screennameError }, { status: 400 });
    }

    // --- Validate password ---
    const passwordError = validatePassword(password ?? "");
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // --- Validate email (basic format check before hashing) ---
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "valid email is required." }, { status: 400 });
    }

    // Hash email immediately — plaintext never written to DB
    const emailHash = hashEmail(email);

    // --- Check uniqueness (case-insensitive screenname, hashed email) ---
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { screenname: { equals: screenname, mode: "insensitive" } },
          { emailHash },
        ],
      },
      select: { screenname: true },
    });

    if (existing) {
      const isScrn = existing.screenname.toLowerCase() === screenname!.toLowerCase();
      return NextResponse.json(
        { error: isScrn ? "screenname taken. try another." : "email already registered." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password!);

    const user = await prisma.user.create({
      data: {
        screenname: screenname!,
        emailHash,
        passwordHash,
        ...(mlkemPublicKey ? { mlkemPublicKey } : {}),
      },
      select: { id: true, screenname: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("[AUTH REGISTER]", err);
    return NextResponse.json({ error: "something went wrong. try again." }, { status: 500 });
  }
}
