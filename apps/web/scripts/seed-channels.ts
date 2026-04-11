#!/usr/bin/env tsx
/**
 * seed-channels.ts — Idempotent seed for default Signoff Chat channels.
 *
 * Usage:
 *   npx tsx scripts/seed-channels.ts --admin-screenname=yourscreenname
 *
 * The admin user is used as the creator for seeded channels.
 * Safe to run multiple times — skips channels that already exist.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CHANNELS = [
  { name: "general",  description: "The main room. Say hi.",                type: "PUBLIC",  category: "OTHER",     isFeatured: true,  isVerified: true },
  { name: "gaming",   description: "Games, scores, and trash talk.",        type: "PUBLIC",  category: "GAMING",    isFeatured: true,  isVerified: true },
  { name: "music",    description: "What are you listening to?",            type: "PUBLIC",  category: "MUSIC",     isFeatured: false, isVerified: true },
  { name: "art",      description: "Share and discuss creative work.",      type: "PUBLIC",  category: "ART",       isFeatured: false, isVerified: true },
  { name: "tech",     description: "Tech talk, dev chat, and build logs.",  type: "PUBLIC",  category: "TECH",      isFeatured: true,  isVerified: true },
  { name: "sports",   description: "Games, scores, and rivalries.",         type: "PUBLIC",  category: "SPORTS",    isFeatured: false, isVerified: true },
  { name: "lounge",   description: "Chill vibes only.",                     type: "PUBLIC",  category: "LIFESTYLE", isFeatured: false, isVerified: true },
  { name: "humor",    description: "Memes, jokes, and absurdity.",          type: "PUBLIC",  category: "HUMOR",     isFeatured: false, isVerified: true },
  { name: "study",    description: "Focused work and accountability.",      type: "PUBLIC",  category: "STUDY",     isFeatured: false, isVerified: true },
  { name: "founders", description: "The original 100. Welcome.",            type: "SECRET",  category: "OTHER",     isFeatured: false, isVerified: true },
] as const;

async function main() {
  const args = process.argv.slice(2);
  const adminArg = args.find((a) => a.startsWith("--admin-screenname="));
  const adminScreenname = adminArg?.split("=")[1];

  if (!adminScreenname) {
    console.error("Usage: npx tsx scripts/seed-channels.ts --admin-screenname=yourscreenname");
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({
    where: { screenname: { equals: adminScreenname, mode: "insensitive" } },
    select: { id: true, screenname: true, adminRole: true },
  });

  if (!admin) {
    console.error(`User "${adminScreenname}" not found.`);
    process.exit(1);
  }

  if (!admin.adminRole) {
    console.warn(`Warning: "${adminScreenname}" is not an admin — creating channels anyway.`);
  }

  console.log(`Seeding channels as creator: ${admin.screenname} (${admin.id})\n`);

  let created = 0;
  let skipped = 0;

  for (const ch of DEFAULT_CHANNELS) {
    const exists = await prisma.channel.findUnique({ where: { name: ch.name } });
    if (exists) {
      console.log(`  skip  #${ch.name} (already exists)`);
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
        creatorId: admin.id,
        slowModeMinutes: 0,
        memberCount: 0,
        messageCount: 0,
      },
    });

    console.log(`  create #${ch.name} [${ch.type}]`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
