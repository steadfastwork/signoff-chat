import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gateway } from "@/lib/gateway";

// Current buddy list + presence from the caller's live OSCAR session.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.screenname) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { buddies } = await gateway.roster(session.user.screenname);
    return NextResponse.json({ buddies });
  } catch {
    return NextResponse.json({ buddies: [] });
  }
}
