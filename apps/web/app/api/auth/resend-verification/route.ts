import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptEmail } from "@/lib/emailEncryption";
import { getHashedIp } from "@/lib/crypto/ip";
import { rateLimit, limiters } from "@/lib/ratelimit";
import { sendVerificationEmail } from "@/lib/verificationEmail";

export async function POST(req: NextRequest) {
  const hashedIp = getHashedIp(req.headers);
  const rl = await rateLimit(limiters.resendVerification, `resend-verify:${hashedIp}`);
  if (rl) return rl;

  try {
    const { screenname } = (await req.json()) as { screenname?: string };

    if (!screenname?.trim()) {
      return NextResponse.json({ error: "screenname is required." }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        screenname: { equals: screenname.trim(), mode: "insensitive" },
        emailVerified: null,
      },
      select: {
        id: true,
        screenname: true,
        emailEncrypted: true,
        emailNonce: true,
      },
    });

    // Return success even if not found — prevents screenname enumeration
    if (!user || !user.emailEncrypted || !user.emailNonce) {
      return NextResponse.json({ ok: true });
    }

    const to = decryptEmail(user.emailEncrypted, user.emailNonce);

    const verificationToken = randomBytes(32).toString("hex");
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiresAt: verificationExpiry,
      },
    });

    await sendVerificationEmail({
      to,
      screenname: user.screenname,
      verificationToken,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[resend-verification]", err);
    return NextResponse.json({ error: "something went wrong. try again." }, { status: 500 });
  }
}
