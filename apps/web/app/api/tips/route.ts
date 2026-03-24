import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTipIntent, TIP_MIN_CENTS, TIP_MAX_CENTS } from "@/lib/stripe-tips";
import { rateLimit, limiters } from "@/lib/ratelimit";
import { stripHtml } from "@/lib/sanitize";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 tips/hr per user (prevent spam tipping)
  const rl = await rateLimit(limiters.tip, `tip:${session.user.id}`);
  if (rl) return rl;

  const body = (await req.json()) as {
    recipientScreenname: string;
    amountCents: number;
    message?: string;
  };

  const { recipientScreenname, amountCents, message: rawMessage } = body;
  const message = rawMessage ? stripHtml(rawMessage) : undefined;

  // ---- Validate ----
  if (!recipientScreenname?.trim()) {
    return NextResponse.json({ error: "recipientScreenname is required." }, { status: 400 });
  }

  const parsedAmount = Math.floor(Number(amountCents));
  if (!Number.isFinite(parsedAmount) || parsedAmount < TIP_MIN_CENTS || parsedAmount > TIP_MAX_CENTS) {
    return NextResponse.json(
      { error: "Amount must be between $1 and $1,000." },
      { status: 400 }
    );
  }

  if (message && message.length > 140) {
    return NextResponse.json({ error: "Message cannot exceed 140 characters." }, { status: 400 });
  }

  // ---- Resolve recipient ----
  const recipient = await prisma.user.findFirst({
    where: { screenname: { equals: recipientScreenname.trim(), mode: "insensitive" } },
    select: { id: true, screenname: true },
  });

  if (!recipient) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (recipient.id === session.user.id) {
    return NextResponse.json({ error: "You cannot tip yourself." }, { status: 400 });
  }

  // ---- Check for block ----
  const blocked = await prisma.buddyRelation.findFirst({
    where: {
      status: "BLOCKED",
      OR: [
        { requesterId: session.user.id, addresseeId: recipient.id },
        { requesterId: recipient.id, addresseeId: session.user.id },
      ],
    },
  });
  if (blocked) {
    return NextResponse.json({ error: "Cannot send tip." }, { status: 403 });
  }

  // ---- Create PaymentIntent ----
  try {
    const intent = await createTipIntent({
      amountCents: parsedAmount,
      senderId: session.user.id,
      recipientId: recipient.id,
      senderScreenname: session.user.screenname,
      recipientScreenname: recipient.screenname,
      message: message?.trim(),
    });

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create tip.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
