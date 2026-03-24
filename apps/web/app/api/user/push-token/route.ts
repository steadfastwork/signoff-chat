import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// POST /api/user/push-token — store or refresh Expo push token
// Called on every login / app foreground.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let token: string | undefined;
  try {
    ({ token } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json." }, { status: 400 });
  }

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  // Validate Expo push token format
  if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
    return NextResponse.json({ error: "invalid expo push token." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { expoPushToken: token },
  });

  // No log of the token value — only the event
  console.info(`[push-token] registered for user ${session.user.id.slice(0, 8)}…`);

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// DELETE /api/user/push-token — clear on logout
// Called before clearing the local session. Best-effort.
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { expoPushToken: null },
  });

  return NextResponse.json({ ok: true });
}
