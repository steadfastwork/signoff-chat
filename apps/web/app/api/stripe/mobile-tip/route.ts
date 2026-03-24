import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTipIntent, TIP_MIN_CENTS, TIP_MAX_CENTS } from "@/lib/stripe-tips";
import { getMobileSession } from "@/lib/mobileAuth";
import { rateLimit, limiters } from "@/lib/ratelimit";
import { stripHtml } from "@/lib/sanitize";

// ---------------------------------------------------------------------------
// POST /api/stripe/mobile-tip
// Mobile-only version of /api/tips — accepts Bearer JWT auth.
// Returns { clientSecret } for use with Stripe Payment Sheet.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(limiters.tip, `tip:${session.id}`);
  if (rl) return rl;

  let recipientScreenname: string | undefined;
  let amountCents: number | undefined;
  let rawMessage: string | undefined;

  try {
    ({ recipientScreenname, amountCents, message: rawMessage } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json." }, { status: 400 });
  }

  const message = rawMessage ? stripHtml(rawMessage) : undefined;

  if (!recipientScreenname?.trim()) {
    return NextResponse.json(
      { error: "recipientScreenname is required." },
      { status: 400 }
    );
  }

  const parsedAmount = Math.floor(Number(amountCents));
  if (
    !Number.isFinite(parsedAmount) ||
    parsedAmount < TIP_MIN_CENTS ||
    parsedAmount > TIP_MAX_CENTS
  ) {
    return NextResponse.json(
      { error: "Amount must be between $1 and $1,000." },
      { status: 400 }
    );
  }

  if (message && message.length > 140) {
    return NextResponse.json(
      { error: "Message cannot exceed 140 characters." },
      { status: 400 }
    );
  }

  const recipient = await prisma.user.findFirst({
    where: {
      screenname: {
        equals: recipientScreenname.trim(),
        mode: "insensitive",
      },
    },
    select: { id: true, screenname: true },
  });

  if (!recipient) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (recipient.id === session.id) {
    return NextResponse.json(
      { error: "You cannot tip yourself." },
      { status: 400 }
    );
  }

  // Check for block in either direction
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: session.id,  blockedId: recipient.id },
        { blockerId: recipient.id, blockedId: session.id },
      ],
    },
  });

  if (blocked) {
    return NextResponse.json({ error: "Cannot send tip." }, { status: 403 });
  }

  try {
    const intent = await createTipIntent({
      amountCents:        parsedAmount,
      senderId:           session.id,
      recipientId:        recipient.id,
      senderScreenname:   session.screenname,
      recipientScreenname: recipient.screenname,
      message:            message?.trim(),
    });

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create tip.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
