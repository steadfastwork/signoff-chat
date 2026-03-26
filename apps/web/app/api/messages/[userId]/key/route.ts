import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { userId: string } };

function dmChannelName(a: string, b: string) {
  return [a, b].sort().join("__dm__");
}

/**
 * GET /api/messages/[userId]/key
 *
 * Returns the active ChannelKey entry for the current user in the DM channel,
 * along with both participants' public keys for key creation.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dmName = dmChannelName(session.user.id, params.userId);
  const dmChannel = await prisma.channel.findUnique({ where: { name: dmName } });

  // Fetch both users' public keys
  const [me, peer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mlkemPublicKey: true },
    }),
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { mlkemPublicKey: true },
    }),
  ]);

  if (!dmChannel) {
    return NextResponse.json({
      key: null,
      myPublicKey: me?.mlkemPublicKey ?? null,
      peerPublicKey: peer?.mlkemPublicKey ?? null,
    });
  }

  // Find the most recent non-expired key that includes this user
  const allKeys = await prisma.channelKey.findMany({
    where: { channelId: dmChannel.id, expiresAt: { gt: new Date() } },
    orderBy: { keyVersion: "desc" },
  });

  const activeKey = allKeys.find((k) => {
    const keys = k.encryptedKeys as Record<string, string>;
    return !!keys[session.user.id];
  });

  return NextResponse.json({
    key: activeKey
      ? {
          channelId: dmChannel.id,
          keyVersion: activeKey.keyVersion,
          myEncryptedKey: (activeKey.encryptedKeys as Record<string, string>)[session.user.id],
        }
      : null,
    myPublicKey: me?.mlkemPublicKey ?? null,
    peerPublicKey: peer?.mlkemPublicKey ?? null,
  });
}

/**
 * POST /api/messages/[userId]/key
 *
 * Create a new ChannelKey for this DM conversation.
 * The DM channel is created if it doesn't exist yet.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.user.id === params.userId) {
    return NextResponse.json({ error: "cannot DM yourself." }, { status: 400 });
  }

  const peer = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true },
  });
  if (!peer) return NextResponse.json({ error: "user not found." }, { status: 404 });

  const { encryptedKeys } = (await req.json()) as { encryptedKeys: Record<string, string> };
  if (!encryptedKeys || typeof encryptedKeys !== "object" || Array.isArray(encryptedKeys)) {
    return NextResponse.json({ error: "encryptedKeys is required." }, { status: 400 });
  }

  const dmName = dmChannelName(session.user.id, params.userId);

  // Find or create DM channel
  let dmChannel = await prisma.channel.findUnique({ where: { name: dmName } });
  if (!dmChannel) {
    dmChannel = await prisma.channel.create({
      data: {
        name: dmName,
        isPrivate: true,
        creatorId: session.user.id,
        members: {
          create: [{ userId: session.user.id }, { userId: params.userId }],
        },
      },
    });
  }

  const latest = await prisma.channelKey.findFirst({
    where: { channelId: dmChannel.id },
    orderBy: { keyVersion: "desc" },
    select: { keyVersion: true },
  });
  const keyVersion = (latest?.keyVersion ?? 0) + 1;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for DMs

  await prisma.channelKey.create({
    data: { channelId: dmChannel.id, encryptedKeys, keyVersion, expiresAt },
  });

  return NextResponse.json({ channelId: dmChannel.id, keyVersion });
}
