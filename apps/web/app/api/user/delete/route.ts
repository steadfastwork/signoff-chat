import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/lib/deletion";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// DELETE /api/user/delete
//
// Permanently and irreversibly deletes the authenticated user's account.
// Requires password confirmation to prevent accidental/CSRF deletion.
//
// No grace period. No soft delete. Immediate and permanent.
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { password } = body as { password?: string };

  if (!password) {
    return NextResponse.json(
      { error: "password confirmation is required to delete your account." },
      { status: 400 }
    );
  }

  // Verify password before irreversible action
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "incorrect password. account not deleted." },
      { status: 403 }
    );
  }

  // Irreversible — everything is gone after this call
  await deleteAccount(session.user.id);

  return NextResponse.json({
    message:
      "Your account has been permanently deleted. Everything is gone. Take care.",
  });
}
