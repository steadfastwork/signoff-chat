import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setAndBroadcastStatus } from "@/lib/presence";
import type { UserStatus } from "@prisma/client";

const VALID_STATUSES: UserStatus[] = [
  "ONLINE",
  "AWAY",
  "IDLE",
  "INVISIBLE",
  "OFFLINE",
];

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body." }, { status: 400 });
  }

  const { status } = body;

  if (!status || !VALID_STATUSES.includes(status as UserStatus)) {
    return NextResponse.json({ error: "invalid status." }, { status: 400 });
  }

  try {
    const user = await setAndBroadcastStatus(
      session.user.id,
      status as UserStatus
    );
    return NextResponse.json({ ok: true, status, user });
  } catch (err) {
    console.error("[STATUS PATCH]", err);
    return NextResponse.json(
      { error: "failed to update status." },
      { status: 500 }
    );
  }
}
