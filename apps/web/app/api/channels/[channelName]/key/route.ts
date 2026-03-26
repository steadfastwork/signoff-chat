import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { channelName: string } };

/**
 * GET /api/channels/[channelName]/key
 *
 * Returns the active ChannelKey entry for the current user, or null.
 * Add ?members=1 to also return member public keys (needed when creating a new key).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = await prisma.channel.findUnique({ where: { name: params.channelName } });
  if (!channel) return NextResponse.json({ error: "not found." }, { status: 404 });

  // Must be a member
  const membership = await prisma.channelMember.findUnique({
    where: { userId_channelId: { userId: session.user.id, channelId: channel.id } },
  });
  if (!membership) return NextResponse.json({ error: "not a member." }, { status: 403 });

  // Find the most recent non-expired ChannelKey that has an entry for this user
  const allKeys = await prisma.channelKey.findMany({
    where: { channelId: channel.id, expiresAt: { gt: new Date() } },
    orderBy: { keyVersion: "desc" },
  });

  const activeKey = allKeys.find((k) => {
    const keys = k.encryptedKeys as Record<string, string>;
    return !!keys[session.user.id];
  });

  const result: Record<string, unknown> = {
    key: activeKey
      ? {
          keyVersion: activeKey.keyVersion,
          myEncryptedKey: (activeKey.encryptedKeys as Record<string, string>)[session.user.id],
        }
      : null,
  };

  // Include member public keys when caller needs to create a new key
  const withMembers = new URL(req.url).searchParams.get("members") === "1";
  if (withMembers) {
    const members = await prisma.channelMember.findMany({
      where: { channelId: channel.id },
      select: { userId: true, user: { select: { mlkemPublicKey: true } } },
    });
    result.members = members
      .filter((m) => m.user.mlkemPublicKey)
      .map((m) => ({ userId: m.userId, mlkemPublicKey: m.user.mlkemPublicKey! }));
  }

  return NextResponse.json(result);
}

/**
 * POST /api/channels/[channelName]/key
 *
 * Create a new ChannelKey. Client generates the session key, encrypts it for
 * each member, and sends the encrypted blobs. The server never sees the raw key.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = await prisma.channel.findUnique({ where: { name: params.channelName } });
  if (!channel) return NextResponse.json({ error: "not found." }, { status: 404 });

  const membership = await prisma.channelMember.findUnique({
    where: { userId_channelId: { userId: session.user.id, channelId: channel.id } },
  });
  if (!membership) return NextResponse.json({ error: "not a member." }, { status: 403 });

  const { encryptedKeys } = (await req.json()) as { encryptedKeys: Record<string, string> };
  if (!encryptedKeys || typeof encryptedKeys !== "object" || Array.isArray(encryptedKeys)) {
    return NextResponse.json({ error: "encryptedKeys is required." }, { status: 400 });
  }

  // Next version number
  const latest = await prisma.channelKey.findFirst({
    where: { channelId: channel.id },
    orderBy: { keyVersion: "desc" },
    select: { keyVersion: true },
  });
  const keyVersion = (latest?.keyVersion ?? 0) + 1;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.channelKey.create({
    data: { channelId: channel.id, encryptedKeys, keyVersion, expiresAt },
  });

  return NextResponse.json({ keyVersion });
}
