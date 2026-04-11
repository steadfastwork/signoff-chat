import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// POST /api/onboarding/step — update the user's onboarding step
// Body: { step: number }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { step?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body." }, { status: 400 });
  }

  const { step } = body;

  if (typeof step !== "number" || step < 0 || step > 5 || !Number.isInteger(step)) {
    return NextResponse.json({ error: "step must be an integer 0–5." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingStep: step },
  });

  return NextResponse.json({ ok: true, step });
}
