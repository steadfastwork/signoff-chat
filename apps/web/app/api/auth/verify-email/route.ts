import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = process.env.NEXTAUTH_URL ?? "";

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid-token`);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
      select: {
        id: true,
        emailVerified: true,
        emailVerificationTokenExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.redirect(`${appUrl}/login?error=invalid-token`);
    }

    // Already verified — just send them to login
    if (user.emailVerified) {
      return NextResponse.redirect(`${appUrl}/login?verified=1`);
    }

    if (
      user.emailVerificationTokenExpiresAt &&
      user.emailVerificationTokenExpiresAt < new Date()
    ) {
      return NextResponse.redirect(`${appUrl}/login?error=expired-token`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return NextResponse.redirect(`${appUrl}/login?verified=1`);
  } catch (err) {
    console.error("[verify-email]", err);
    return NextResponse.redirect(`${appUrl}/login?error=server-error`);
  }
}
