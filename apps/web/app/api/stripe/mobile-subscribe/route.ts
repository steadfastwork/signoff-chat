import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, getOrCreateCustomer, GOLD_PRICE_ID } from "@/lib/stripe";
import { getMobileSession } from "@/lib/mobileAuth";

// ---------------------------------------------------------------------------
// POST /api/stripe/mobile-subscribe
// Mobile-only. Creates an incomplete Stripe subscription and returns the
// first invoice's PaymentIntent client_secret for use with Payment Sheet.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!GOLD_PRICE_ID) {
    return NextResponse.json(
      { error: "Gold membership is not configured yet." },
      { status: 503 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
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

  const customerId = await getOrCreateCustomer(
    session.id,
    null,
    session.screenname
  );

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: GOLD_PRICE_ID }],
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    expand: ["latest_invoice.payment_intent"],
    metadata: { userId: session.id },
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | null;

  if (!paymentIntent?.client_secret) {
    // Clean up the incomplete subscription so we don't leave dangling records
    await stripe.subscriptions.cancel(subscription.id).catch(() => {});
    return NextResponse.json(
      { error: "failed to create payment intent." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    clientSecret:   paymentIntent.client_secret,
    customerId,
    subscriptionId: subscription.id,
  });
}
