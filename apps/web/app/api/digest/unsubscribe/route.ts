import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// GET /api/digest/unsubscribe?token={jwt}
//
// Verifies the signed JWT (type=digest-unsub), disables the user's digest,
// then redirects to /unsubscribed?from=digest.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse("Missing token.", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    // Validate shape
    if (
      typeof payload.sub !== "string" ||
      payload["type"] !== "digest-unsub"
    ) {
      return new NextResponse("Invalid token.", { status: 400, headers: { "Content-Type": "text/plain" } });
    }

    const userId = payload.sub;

    // Disable digest — idempotent (safe to click multiple times)
    await prisma.user.update({
      where: { id: userId },
      data: { digestEnabled: false },
    });

    // Redirect to confirmation page
    return NextResponse.redirect(
      new URL("/unsubscribed?from=digest", process.env.NEXTAUTH_URL ?? req.url)
    );
  } catch {
    return new NextResponse(
      "This unsubscribe link is invalid or has expired. Please log in to manage your digest settings.",
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }
}
