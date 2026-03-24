import { stripe } from "@/lib/stripe";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TIP_MIN_CENTS = 100;   // $1.00
export const TIP_MAX_CENTS = 100_000; // $1,000.00
export const PLATFORM_FEE_PERCENT = 10;

// ---------------------------------------------------------------------------
// Create a tip PaymentIntent
//
// TODO: When Stripe Connect is set up, add `application_fee_amount` to route
// 90% of each tip to the creator's connected account. Until then, payments
// go to the platform Stripe account and creator payouts are handled manually.
//
// With Connect it would look like:
//   const intent = await stripe.paymentIntents.create({
//     amount: amountCents,
//     currency: "usd",
//     application_fee_amount: Math.floor(amountCents * PLATFORM_FEE_PERCENT / 100),
//     transfer_data: { destination: creatorStripeAccountId },
//     metadata: { senderId, recipientId, message: message ?? "" },
//   });
// ---------------------------------------------------------------------------

export async function createTipIntent({
  amountCents,
  senderId,
  recipientId,
  recipientScreenname,
  senderScreenname,
  message,
}: {
  amountCents: number;
  senderId: string;
  recipientId: string;
  recipientScreenname: string;
  senderScreenname: string;
  message?: string;
}) {
  if (amountCents < TIP_MIN_CENTS || amountCents > TIP_MAX_CENTS) {
    throw new Error(`Amount must be between $1 and $1,000.`);
  }

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    description: `Tip from ${senderScreenname} to ${recipientScreenname}`,
    metadata: {
      kind: "tip",
      senderId,
      recipientId,
      senderScreenname,
      recipientScreenname,
      message: message ?? "",
      feeCents: String(Math.floor(amountCents * PLATFORM_FEE_PERCENT / 100)),
    },
  });

  return intent;
}

// ---------------------------------------------------------------------------
// Format cents → display string
// ---------------------------------------------------------------------------

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
