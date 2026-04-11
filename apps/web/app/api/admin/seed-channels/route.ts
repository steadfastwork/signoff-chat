import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, notFound } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// Default channels to seed (idempotent — skip if name already exists)
// ---------------------------------------------------------------------------

const DEFAULT_CHANNELS = [
  {
    name: "general",
    description: "The main room. Say hi.",
    type: "PUBLIC" as const,
    category: "OTHER" as const,
    isFeatured: true,
    isVerified: true,
  },
  {
    name: "gaming",
    description: "Games, scores, and trash talk.",
    type: "PUBLIC" as const,
    category: "GAMING" as const,
    isFeatured: true,
    isVerified: true,
  },
  {
    name: "music",
    description: "What are you listening to?",
    type: "PUBLIC" as const,
    category: "MUSIC" as const,
    isFeatured: false,
    isVerified: true,
  },
  {
    name: "art",
    description: "Share and discuss creative work.",
    type: "PUBLIC" as const,
    category: "ART" as const,
    isFeatured: false,
    isVerified: true,
  },
  {
    name: "tech",
    description: "Tech talk, dev chat, and build logs.",
    type: "PUBLIC" as const,
    category: "TECH" as const,
    isFeatured: true,
    isVerified: true,
  },
  {
    name: "sports",
    description: "Games, scores, and rivalries.",
    type: "PUBLIC" as const,
    category: "SPORTS" as const,
    isFeatured: false,
    isVerified: true,
  },
  {
    name: "lounge",
    description: "Chill vibes only.",
    type: "PUBLIC" as const,
    category: "LIFESTYLE" as const,
    isFeatured: false,
    isVerified: true,
  },
  {
    name: "humor",
    description: "Memes, jokes, and absurdity.",
    type: "PUBLIC" as const,
    category: "HUMOR" as const,
    isFeatured: false,
    isVerified: true,
  },
  {
    name: "study",
    description: "Focused work and accountability.",
    type: "PUBLIC" as const,
    category: "STUDY" as const,
    isFeatured: false,
    isVerified: true,
  },
  {
    name: "founders",
    description: "The original 100. Welcome.",
    type: "SECRET" as const,
    category: "OTHER" as const,
    isFeatured: false,
    isVerified: true,
  },
] as const;

// ---------------------------------------------------------------------------
// POST /api/admin/seed-channels
// Idempotent: skips channels that already exist by name.
// Returns counts of created vs. skipped.
// ---------------------------------------------------------------------------

export async function POST() {
  const session = await getServerSession(authOptions);
  try { requireSuperAdmin(session); } catch { return notFound(); }

  if (!session?.user?.id) return notFound();

  const creatorId = session.user.id;

  let created = 0;
  let skipped = 0;

  for (const ch of DEFAULT_CHANNELS) {
    const exists = await prisma.channel.findUnique({ where: { name: ch.name } });
    if (exists) {
      skipped++;
      continue;
    }

    await prisma.channel.create({
      data: {
        name: ch.name,
        description: ch.description,
        type: ch.type,
        category: ch.category,
        isFeatured: ch.isFeatured,
        isVerified: ch.isVerified,
        creatorId,
        slowModeMinutes: 0,
        memberCount: 0,
        messageCount: 0,
      },
    });
    created++;
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    total: DEFAULT_CHANNELS.length,
  });
}
