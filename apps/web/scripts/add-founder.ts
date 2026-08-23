import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const screenname = process.argv[2] || 'Craig'

  // Find the user
  const user = await prisma.user.findFirst({
    where: { screenname: { equals: screenname, mode: 'insensitive' } }
  })

  if (!user) {
    console.error(`❌ No user found with screenname: ${screenname}`)
    process.exit(1)
  }

  console.log(`✓ Found user: ${user.screenname} (${user.id})`)

  // Get all channels
  const channels = await prisma.channel.findMany()
  console.log(`✓ Found ${channels.length} channels`)

  let added = 0
  let skipped = 0

  for (const channel of channels) {
    // Check if already a member
    const existing = await prisma.channelMember.findFirst({
      where: { userId: user.id, channelId: channel.id }
    })

    if (existing) {
      console.log(`  — already in #${channel.name}, skipping`)
      skipped++
      continue
    }

    await prisma.channelMember.create({
      data: {
        userId: user.id,
        channelId: channel.id,
      }
    })

    console.log(`  + added to #${channel.name}`)
    added++
  }

  // Award Founder badge if not already awarded
  const existingBadge = await prisma.userBadge.findFirst({
    where: { userId: user.id, badge: 'FOUNDER' }
  })

  if (!existingBadge) {
    await prisma.userBadge.create({
      data: {
        userId: user.id,
        badge: 'FOUNDER',
        awardedById: user.screenname,
        note: 'Founding member — added via seed script',
      }
    })
    console.log(`  ⚡ Founder badge awarded`)
  } else {
    console.log(`  — Founder badge already exists, skipping`)
  }

  console.log(`\n✅ Done. Added to ${added} channels, skipped ${skipped} (already member).`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
