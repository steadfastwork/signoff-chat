import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { internalError } from "@/lib/api-error";

type Params = { params: { postId: string } };

// ---------------------------------------------------------------------------
// POST /api/posts/[postId]/echo — echo (reblog) a post
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { postId } = params;

    const original = await prisma.awayMessageHistory.findUnique({
      where:  { id: postId },
      select: {
        id:           true,
        content:      true,
        postType:     true,
        bodyText:     true,
        quoteText:    true,
        quoteAttrib:  true,
        imageUrl:     true,
        imageCaption: true,
        tags:         true,
        echoOfId:     true,
        userId:       true,
      },
    });

    if (!original) {
      return NextResponse.json({ error: "post not found." }, { status: 404 });
    }

    // Echoes always point to the root post — don't chain echoes of echoes
    const rootId = original.echoOfId ?? original.id;

    // Prevent the same user from echoing the same root post twice
    const existing = await prisma.awayMessageHistory.findFirst({
      where:  { userId: session.user.id, echoOfId: rootId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "already echoed." }, { status: 409 });
    }

    const echo = await prisma.$transaction(async (tx) => {
      const created = await tx.awayMessageHistory.create({
        data: {
          // Copy all content fields from the root post
          content:      original.content,
          postType:     original.postType,
          bodyText:     original.bodyText,
          quoteText:    original.quoteText,
          quoteAttrib:  original.quoteAttrib,
          imageUrl:     original.imageUrl,
          imageCaption: original.imageCaption,
          tags:         original.tags,
          // Echo metadata
          userId:       session.user.id,
          echoOfId:     rootId,
          visibility:   "PUBLIC",
        },
        select: {
          id:           true,
          setAt:        true,
          content:      true,
          visibility:   true,
          nudgeCount:   true,
          replyCount:   true,
          echoCount:    true,
          postType:     true,
          bodyText:     true,
          quoteText:    true,
          quoteAttrib:  true,
          imageUrl:     true,
          imageCaption: true,
          tags:         true,
          echoOfId:     true,
          user: {
            select: {
              id:           true,
              screenname:   true,
              isGoldMember: true,
              avatarUrl:    true,
              status:       true,
            },
          },
        },
      });

      // Increment the root post's echo counter
      await tx.awayMessageHistory.update({
        where: { id: rootId },
        data:  { echoCount: { increment: 1 } },
      });

      return created;
    });

    // Create PostTag records so the echo is discoverable by tag
    if (original.tags.length > 0) {
      await prisma.postTag.createMany({
        data:           original.tags.map((tag) => ({ tag, postId: echo.id })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json(echo, { status: 201 });
  } catch (err) {
    return internalError(err, "POST /api/posts/[postId]/echo");
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/posts/[postId]/echo — remove an echo you created
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { postId } = params;

    const echo = await prisma.awayMessageHistory.findUnique({
      where:  { id: postId },
      select: { id: true, userId: true, echoOfId: true },
    });

    if (!echo) {
      return NextResponse.json({ error: "post not found." }, { status: 404 });
    }
    if (echo.userId !== session.user.id) {
      return NextResponse.json({ error: "forbidden." }, { status: 403 });
    }
    if (!echo.echoOfId) {
      return NextResponse.json({ error: "this post is not an echo." }, { status: 400 });
    }

    const rootId = echo.echoOfId;

    await prisma.$transaction([
      // Deleting the echo also cascades to its PostTag rows
      prisma.awayMessageHistory.delete({ where: { id: postId } }),
      // Guard against going below zero (updateMany ignores if count = 0)
      prisma.awayMessageHistory.updateMany({
        where: { id: rootId, echoCount: { gt: 0 } },
        data:  { echoCount: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err, "DELETE /api/posts/[postId]/echo");
  }
}
