import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripHtml, sanitizeRichText, richTextLength } from "@/lib/sanitize";

type Params = { params: { postId: string } };

// ---------------------------------------------------------------------------
// PATCH /api/posts/[postId] — edit own post; sets editedAt = now()
//
// Body fields (send only the field(s) relevant to the postType):
//   content?:      string  — AWAY posts
//   bodyText?:     string  — THOUGHT posts
//   quoteText?:    string  — QUOTE posts
//   quoteAttrib?:  string  — QUOTE posts (optional attribution)
//   imageCaption?: string  — PHOTO posts
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: Params
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const post = await prisma.awayMessageHistory.findUnique({
    where:  { id: params.postId },
    select: { userId: true, postType: true },
  });

  if (!post) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }
  if (post.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  const body = await req.json() as {
    content?:      string;
    bodyText?:     string;
    quoteText?:    string;
    quoteAttrib?:  string;
    imageCaption?: string;
  };

  const now = new Date();
  let updateData: Record<string, unknown> = { editedAt: now };

  if (post.postType === "AWAY") {
    const cleaned = stripHtml(body.content ?? "").trim();
    if (!cleaned) {
      return NextResponse.json({ error: "content is required." }, { status: 400 });
    }
    if (cleaned.length > 140) {
      return NextResponse.json({ error: "content cannot exceed 140 characters." }, { status: 400 });
    }
    updateData.content = cleaned;

  } else if (post.postType === "THOUGHT") {
    const cleaned = sanitizeRichText(body.bodyText ?? "");
    if (!richTextLength(cleaned)) {
      return NextResponse.json({ error: "bodyText is required." }, { status: 400 });
    }
    if (richTextLength(cleaned) > 5000) {
      return NextResponse.json({ error: "bodyText cannot exceed 5000 characters." }, { status: 400 });
    }
    updateData.bodyText = cleaned;

  } else if (post.postType === "QUOTE") {
    const cleaned = stripHtml(body.quoteText ?? "").trim();
    if (!cleaned) {
      return NextResponse.json({ error: "quoteText is required." }, { status: 400 });
    }
    if (cleaned.length > 500) {
      return NextResponse.json({ error: "quoteText cannot exceed 500 characters." }, { status: 400 });
    }
    updateData.quoteText = cleaned;
    if (body.quoteAttrib !== undefined) {
      updateData.quoteAttrib = stripHtml(body.quoteAttrib).trim().slice(0, 140) || null;
    }

  } else if (post.postType === "PHOTO") {
    if (body.imageCaption !== undefined) {
      const cap = stripHtml(body.imageCaption).trim().slice(0, 200);
      updateData.imageCaption = cap || null;
    }
  }

  const updated = await prisma.awayMessageHistory.update({
    where:  { id: params.postId },
    data:   updateData,
    select: { id: true, editedAt: true, content: true, bodyText: true, quoteText: true, quoteAttrib: true, imageCaption: true },
  });

  return NextResponse.json(updated);
}

// ---------------------------------------------------------------------------
// DELETE /api/posts/[postId] — delete own post
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: Params
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const post = await prisma.awayMessageHistory.findUnique({
    where:  { id: params.postId },
    select: { userId: true },
  });

  if (!post) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }
  if (post.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  await prisma.awayMessageHistory.delete({ where: { id: params.postId } });

  return NextResponse.json({ ok: true });
}
