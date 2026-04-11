import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// POST /api/onboarding/aim-screenname — store privacy-preserving hash of
// the user's old AIM screenname.
//
// Body: { hash: string }  — SHA-256 hex digest of normalized screenname.
// The raw screenname is never sent to or stored on the server.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { hash?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body." }, { status: 400 });
  }

  const { hash } = body;

  if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json(
      { error: "hash must be a 64-character hex SHA-256 digest." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { aimScreennameHash: hash },
  });

  return NextResponse.json({ ok: true });
}
