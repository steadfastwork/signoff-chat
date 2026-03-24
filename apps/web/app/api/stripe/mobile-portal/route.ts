import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getMobileSession } from "@/lib/mobileAuth";

// ---------------------------------------------------------------------------
// POST /api/stripe/mobile-portal
// Mobile-only. Creates a Stripe Billing Portal session and returns the URL.
// The mobile app opens this URL in the device browser via Linking.openURL.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "no subscription found." },
      { status: 404 }
    );
  }

  const returnUrl = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/upgrade`
    : "signoffchat://upgrade";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: portalSession.url });
}
