import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";
import { deriveAvatarColor } from "@/lib/auth";

const TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function POST(req: NextRequest) {
  let screenname: string | undefined;
  let password: string | undefined;

  try {
    ({ screenname, password } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json." }, { status: 400 });
  }

  if (!screenname?.trim() || !password) {
    return NextResponse.json(
      { error: "screenname and password are required." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      screenname: { equals: screenname.trim(), mode: "insensitive" },
    },
    select: {
      id: true,
      screenname: true,
      passwordHash: true,
      isGoldMember: true,
      isAdmin: true,
      isSuspended: true,
      suspendedUntil: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "invalid credentials. try again." },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "invalid credentials. try again." },
      { status: 401 }
    );
  }

  if (user.isSuspended) {
    const msg = user.suspendedUntil
      ? `account suspended until ${user.suspendedUntil.toISOString()}.`
      : "account suspended.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const avatarColor = deriveAvatarColor(user.id);
  const expiresAt = Date.now() + TOKEN_MAX_AGE_SECONDS * 1000;

  const token = await encode({
    token: {
      sub:          user.id,
      id:           user.id,
      screenname:   user.screenname,
      isGoldMember: user.isGoldMember,
      isAdmin:      user.isAdmin,
      avatarColor,
    },
    secret:  process.env.NEXTAUTH_SECRET ?? "",
    maxAge:  TOKEN_MAX_AGE_SECONDS,
  });

  return NextResponse.json({
    token,
    userId:       user.id,
    screenname:   user.screenname,
    isGoldMember: user.isGoldMember,
    isAdmin:      user.isAdmin,
    avatarColor,
    expiresAt,
  });
}
