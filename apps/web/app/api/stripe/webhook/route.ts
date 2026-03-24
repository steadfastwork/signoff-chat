import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";
import { notifyTipReceived } from "@/lib/expoNotifications";

// Next.js App Router: disable body parsing so we get the raw buffer
export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "webhook error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // checkout.session.completed — subscription activated
  // ---------------------------------------------------------------------------
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return NextResponse.json({ ok: true });

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

    if (!customerId) return NextResponse.json({ ok: true });

    // Look up user by stripeCustomerId
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isGoldMember: true },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // customer.subscription.deleted — subscription cancelled/expired
  // ---------------------------------------------------------------------------
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;

    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isGoldMember: false },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // customer.subscription.updated — handle reactivation after cancellation
  // ---------------------------------------------------------------------------
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;

    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });

    if (user) {
      const isActive = sub.status === "active" || sub.status === "trialing";
      await prisma.user.update({
        where: { id: user.id },
        data: { isGoldMember: isActive },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // payment_intent.succeeded — record tip in DB
  // ---------------------------------------------------------------------------
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.metadata.kind !== "tip") return NextResponse.json({ ok: true });

    const { senderId, recipientId, message } = intent.metadata;
    if (senderId && recipientId) {
      await prisma.tip.create({
        data: {
          senderId,
          recipientId,
          amount: intent.amount,
          message: message || null,
          stripePaymentIntentId: intent.id,
        },
      });

      // Notify the recipient — we need the sender's screenname
      const sender = await prisma.user.findUnique({
        where:  { id: senderId },
        select: { screenname: true },
      });
      if (sender) {
        notifyTipReceived(recipientId, sender.screenname, intent.amount).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
