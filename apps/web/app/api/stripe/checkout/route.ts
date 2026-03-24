import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, getOrCreateCustomer, GOLD_PRICE_ID } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!GOLD_PRICE_ID) {
    return NextResponse.json(
      { error: "Gold membership is not configured yet." },
      { status: 503 }
    );
  }

  // Don't create a new checkout if already Gold
  // We no longer store plaintext email — Stripe customer is created without email.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isGoldMember: true },
  });

  if (!user) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  if (user.isGoldMember) {
    return NextResponse.json(
      { error: "you're already a Gold member." },
      { status: 409 }
    );
  }

  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // Pass screenname only — no email stored on our end
  const customerId = await getOrCreateCustomer(
    session.user.id,
    null,
    session.user.screenname
  );

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: GOLD_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/upgrade?success=1`,
    cancel_url: `${origin}/upgrade?canceled=1`,
    subscription_data: {
      metadata: { userId: session.user.id },
    },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });

  return NextResponse.json({ url: checkoutSession.url });
}
