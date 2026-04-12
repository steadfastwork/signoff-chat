import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find or create a Stripe customer for a given user.
 * Stores the customerId back on the user row.
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string | null,
  screenname: string
): Promise<string> {
  const { prisma } = await import("@/lib/prisma");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    name: screenname,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Cancel all active Stripe subscriptions for a user.
 * Queries Stripe by userId metadata because the user row may already be
 * deleted from the database when this is called (e.g. during account deletion).
 */
export async function cancelStripeSubscription(userId: string): Promise<void> {
  const customers = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });

  const customer = customers.data[0];
  if (!customer) return;

  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: "active",
    limit: 10,
  });

  await Promise.all(
    subscriptions.data.map((sub) => stripe.subscriptions.cancel(sub.id))
  );
}

// The env var name for the webhook secret
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
// The env var name for the Gold price ID
export const GOLD_PRICE_ID = process.env.STRIPE_GOLD_PRICE_ID ?? "";
