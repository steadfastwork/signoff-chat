import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addUserToFoundersChannel } from "@/lib/founders";

// ---------------------------------------------------------------------------
// POST /api/onboarding/complete — mark onboarding as complete
//
// 1. Sets onboardingComplete=true, onboardingStep=5
// 2. Checks FOUNDER badge cap (first 100 users)
// 3. Awards FOUNDER badge if eligible
// Returns: { founderAwarded: boolean }
// ---------------------------------------------------------------------------

const FOUNDER_CAP = 100;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Mark onboarding complete
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingComplete: true, onboardingStep: 5 },
  });

  // Check if user already has FOUNDER badge
  const existingBadge = await prisma.userBadge.findFirst({
    where: { userId, badge: "FOUNDER" },
  });

  if (existingBadge) {
    return NextResponse.json({ founderAwarded: false });
  }

  // Count total FOUNDER badges awarded
  const founderCount = await prisma.userBadge.count({
    where: { badge: "FOUNDER" },
  });

  if (founderCount >= FOUNDER_CAP) {
    return NextResponse.json({ founderAwarded: false });
  }

  // Award FOUNDER badge (self-awarded via system — awardedById = userId)
  await prisma.userBadge.create({
    data: {
      userId,
      badge: "FOUNDER",
      awardedById: userId,
      note: "Awarded automatically as one of the first 100 members.",
    },
  });

  // Auto-add to #founders SECRET channel
  await addUserToFoundersChannel(userId);

  return NextResponse.json({ founderAwarded: true });
}
