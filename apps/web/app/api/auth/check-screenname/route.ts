import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateScreenname } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const screenname = req.nextUrl.searchParams.get("screenname") ?? "";

  if (validateScreenname(screenname)) {
    return NextResponse.json({ available: false });
  }

  const existing = await prisma.user.findFirst({
    where: { screenname: { equals: screenname, mode: "insensitive" } },
    select: { id: true },
  });

  return NextResponse.json({ available: !existing });
}
