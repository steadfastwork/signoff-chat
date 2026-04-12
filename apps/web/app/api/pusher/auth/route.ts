import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.error("[pusher/auth] no session — returning 401");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "missing parameters." }, { status: 400 });
  }

  const userData = {
    user_id: session.user.id,
    user_info: {
      screenname: session.user.screenname,
      isGoldMember: session.user.isGoldMember,
    },
  };

  const authResponse = pusherServer.authorizeChannel(socketId, channelName, userData);
  console.log("[pusher/auth] response:", JSON.stringify(authResponse));
  return NextResponse.json(authResponse);
}
