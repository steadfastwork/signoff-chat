import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, deriveAvatarColor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CURRENTLY_KEYS,
  CURRENTLY_MAX_CHARS,
  parseCurrently,
  type CurrentlyData,
} from "@/lib/currently";
import { VALID_DM_COLORS, VALID_DM_FONT_SIZES } from "@/lib/dmColors";
import {
  broadcastCurrentlyChanged,
  broadcastAwayMessageChanged,
  type AwayFeedEntry,
} from "@/lib/presence";

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
      currently: true,
      status: true,
      isGoldMember: true,
      profileTheme: true,
      avatarUrl: true,
      soundPack: true,
      createdAt: true,
      feedVisibility: true,
      dmTextColor: true,
      dmFontSize: true,
    },
  });

  if (!user) return NextResponse.json(null);

  return NextResponse.json({
    ...user,
    currently: parseCurrently(user.currently),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { bio, awayMessage, awayVisibility, status, profileTheme, soundPack, clearAvatar, avatarUrl, feedVisibility, currently, dmTextColor, dmFontSize } = body;
  const data: Record<string, unknown> = {};

  if (bio !== undefined) {
    if (bio.length > 160) {
      return NextResponse.json({ error: "bio cannot exceed 160 characters." }, { status: 400 });
    }
    data.bio = bio.trim();
  }
  let resolvedAwayVisibility: "PUBLIC" | "BUDDIES" | "PRIVATE" = "PUBLIC";
  if (awayMessage !== undefined) {
    if (awayMessage.length > 140) {
      return NextResponse.json(
        { error: "away message cannot exceed 140 characters." },
        { status: 400 }
      );
    }
    data.awayMessage = awayMessage.trim();
    data.awayMessageSetAt = new Date();
    if (awayVisibility && ["PUBLIC", "BUDDIES", "PRIVATE"].includes(awayVisibility)) {
      resolvedAwayVisibility = awayVisibility;
    }
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
    select: { isGoldMember: true, currently: true },
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
  if (avatarUrl !== undefined && currentUser?.isGoldMember) {
    const isUtUrl =
      typeof avatarUrl === "string" &&
      (avatarUrl.startsWith("https://utfs.io/") ||
        avatarUrl.startsWith("https://sea1.ufs.sh/") ||
        avatarUrl.includes(".ufs.sh/") ||
        avatarUrl.includes("uploadthing.com/"));
    if (isUtUrl) data.avatarUrl = avatarUrl;
  }
  if (feedVisibility !== undefined) {
    const valid = ["PUBLIC", "BUDDIES", "PRIVATE"];
    if (valid.includes(feedVisibility)) {
      data.feedVisibility = feedVisibility;
    }
  }

  // DM text style preferences
  if (dmTextColor !== undefined) {
    if (!VALID_DM_COLORS.includes(dmTextColor)) {
      return NextResponse.json({ error: "invalid dmTextColor." }, { status: 400 });
    }
    data.dmTextColor = dmTextColor;
  }
  if (dmFontSize !== undefined) {
    if (!VALID_DM_FONT_SIZES.includes(dmFontSize)) {
      return NextResponse.json({ error: "invalid dmFontSize." }, { status: 400 });
    }
    data.dmFontSize = dmFontSize;
  }

  // Currently — validate + merge with existing
  let updatedCurrently: CurrentlyData | null = null;
  if (currently !== undefined) {
    if (typeof currently !== "object" || Array.isArray(currently)) {
      return NextResponse.json({ error: "invalid currently." }, { status: 400 });
    }
    // Reject unknown keys
    const incoming = currently as Record<string, unknown>;
    for (const k of Object.keys(incoming)) {
      if (!(CURRENTLY_KEYS as readonly string[]).includes(k)) {
        return NextResponse.json(
          { error: `unknown currently field: ${k}` },
          { status: 400 }
        );
      }
    }
    // Validate lengths
    for (const k of CURRENTLY_KEYS) {
      const v = incoming[k];
      if (v !== undefined && typeof v === "string" && v.length > CURRENTLY_MAX_CHARS) {
        return NextResponse.json(
          { error: `${k} exceeds ${CURRENTLY_MAX_CHARS} characters.` },
          { status: 400 }
        );
      }
    }
    // Merge with existing, strip empty strings
    const existing = parseCurrently(currentUser?.currently);
    const merged: CurrentlyData = { ...existing };
    for (const k of CURRENTLY_KEYS) {
      if (k in incoming) {
        const v = typeof incoming[k] === "string" ? (incoming[k] as string).trim() : "";
        if (v) merged[k] = v.slice(0, CURRENTLY_MAX_CHARS);
        else delete merged[k];
      }
    }
    data.currently = merged;
    updatedCurrently = merged;
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      screenname: true,
      bio: true,
      awayMessage: true,
      awayMessageSetAt: true,
      currently: true,
      status: true,
      isGoldMember: true,
      avatarUrl: true,
      profileTheme: true,
      soundPack: true,
      feedVisibility: true,
    },
  });

  // Broadcast currently change to buddies in real-time
  if (updatedCurrently !== null) {
    broadcastCurrentlyChanged(
      session.user.id,
      user.screenname,
      updatedCurrently
    ).catch(() => {});
  }

  // Create AwayMessageHistory record + broadcast when away message changes
  if (awayMessage !== undefined && (awayMessage as string).trim()) {
    const historyEntry = await prisma.awayMessageHistory.create({
      data: {
        userId: session.user.id,
        content: (awayMessage as string).trim(),
        visibility: resolvedAwayVisibility,
      },
    });

    const parsedCurrently = parseCurrently(user.currently);
    const entry: AwayFeedEntry = {
      userId: user.id,
      screenname: user.screenname,
      isGoldMember: user.isGoldMember,
      avatarColor: deriveAvatarColor(user.id),
      avatarUrl: user.avatarUrl ?? null,
      currently: parsedCurrently,
      status: user.status,
      away: {
        id: historyEntry.id,
        content: historyEntry.content,
        setAt: historyEntry.setAt.toISOString(),
        visibility: historyEntry.visibility,
        nudgeCount: 0,
        replyCount: 0,
      },
    };
    broadcastAwayMessageChanged(session.user.id, entry).catch(() => {});
  }

  return NextResponse.json({
    ...user,
    currently: parseCurrently(user.currently),
  });
}
