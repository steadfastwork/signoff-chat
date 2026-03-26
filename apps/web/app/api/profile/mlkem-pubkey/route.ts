import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET — check whether the current user has encryption set up. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mlkemPublicKey: true, hasConfirmedBackup: true },
  });

  return NextResponse.json({
    hasPublicKey: !!user?.mlkemPublicKey,
    hasConfirmedBackup: user?.hasConfirmedBackup ?? false,
    // Public key returned so the client can verify a recovery mnemonic locally.
    // The public key is not secret — it is already shared with channel members.
    mlkemPublicKey: user?.mlkemPublicKey ?? null,
  });
}

/** POST — store the user's ML-KEM-1024 public key. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { mlkemPublicKey } = (await req.json()) as { mlkemPublicKey?: string };
  if (!mlkemPublicKey || typeof mlkemPublicKey !== "string") {
    return NextResponse.json({ error: "mlkemPublicKey is required." }, { status: 400 });
  }

  // Basic sanity: ML-KEM-1024 public key is 1568 bytes → ~2092 base64 chars
  if (mlkemPublicKey.length < 2000 || mlkemPublicKey.length > 2200) {
    return NextResponse.json({ error: "invalid public key length." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mlkemPublicKey },
  });

  return NextResponse.json({ ok: true });
}

/** PATCH — mark backup phrase as confirmed. */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { hasConfirmedBackup } = (await req.json()) as { hasConfirmedBackup?: boolean };
  if (hasConfirmedBackup !== true) {
    return NextResponse.json({ error: "invalid request." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { hasConfirmedBackup: true },
  });

  return NextResponse.json({ ok: true });
}
