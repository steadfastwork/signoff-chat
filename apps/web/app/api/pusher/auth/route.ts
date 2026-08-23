import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import { normScreenname } from "@/lib/gatewayChannel";

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

  // userData (channel_data) must only be passed for presence channels.
  // For private channels the HMAC is signed over "socketId:channelName" only —
  // passing userData causes the SDK to sign over "socketId:channelName:channelData"
  // which Soketi rejects with 401.
  // A user's personal channel (`private-user-<x>`) must belong to them: <x> is
  // either their Postgres id (existing badge notifications) or their normalized
  // screenname (the gateway's OSCAR relay). Reject anyone else's.
  if (channelName.startsWith("private-user-")) {
    const target = channelName.slice("private-user-".length);
    const ownScreennameChannel = normScreenname(session.user.screenname ?? "");
    if (target !== session.user.id && target !== ownScreennameChannel) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const isPresence = channelName.startsWith("presence-");
  const authResponse = isPresence
    ? pusherServer.authorizeChannel(socketId, channelName, {
        user_id: session.user.id,
        user_info: {
          screenname: session.user.screenname,
          isGoldMember: session.user.isGoldMember,
        },
      })
    : pusherServer.authorizeChannel(socketId, channelName);

  return NextResponse.json(authResponse);
}
