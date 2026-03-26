import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      screenname: true,
      bio: true,
      awayMessage: true,
      status: true,
      isGoldMember: true,
      profileTheme: true,
      avatarUrl: true,
      soundPack: true,
      createdAt: true,
      feedVisibility: true,
    },
  });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { bio, awayMessage, status, profileTheme, soundPack, clearAvatar, feedVisibility } = await req.json();
  const data: Record<string, unknown> = {};

  if (bio !== undefined) {
    if (bio.length > 160) {
      return NextResponse.json({ error: "bio cannot exceed 160 characters." }, { status: 400 });
    }
    data.bio = bio.trim();
  }
  if (awayMessage !== undefined) {
    if (awayMessage.length > 140) {
      return NextResponse.json(
        { error: "away message cannot exceed 140 characters." },
        { status: 400 }
      );
    }
    data.awayMessage = awayMessage.trim();
  }
  if (status !== undefined) {
    const valid = ["ONLINE", "AWAY", "IDLE", "INVISIBLE", "OFFLINE"];
    if (!valid.includes(status)) {
      return NextResponse.json({ error: "invalid status." }, { status: 400 });
    }
    data.status = status;
  }
  // Gold-only fields
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isGoldMember: true },
  });
  if (profileTheme !== undefined && currentUser?.isGoldMember) {
    const VALID_THEMES = ["midnight", "forest", "ocean", "rose", "matrix", "sepia"];
    data.profileTheme = VALID_THEMES.includes(profileTheme) ? profileTheme : null;
  }
  if (soundPack !== undefined && currentUser?.isGoldMember) {
    const VALID_PACKS = ["classic", "retro", "minimal"];
    data.soundPack = VALID_PACKS.includes(soundPack) ? soundPack : null;
  }
  if (clearAvatar === true && currentUser?.isGoldMember) {
    data.avatarUrl = null;
  }
  if (feedVisibility !== undefined) {
    const valid = ["PUBLIC", "BUDDIES", "PRIVATE"];
    if (valid.includes(feedVisibility)) {
      data.feedVisibility = feedVisibility;
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      screenname: true,
      bio: true,
      awayMessage: true,
      status: true,
      isGoldMember: true,
      profileTheme: true,
      avatarUrl: true,
      soundPack: true,
      feedVisibility: true,
    },
  });

  return NextResponse.json(user);
}
