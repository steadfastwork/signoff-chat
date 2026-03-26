/**
 * Mobile Bearer-token auth helper.
 *
 * Mobile clients send `Authorization: Bearer <jwt>` where the JWT is issued
 * by /api/auth/mobile/login using the same NEXTAUTH_SECRET as the web app.
 * This helper decodes that token and returns a typed session.
 */

import { type NextRequest } from "next/server";
import { decode } from "next-auth/jwt";

export interface MobileSession {
  id: string;
  screenname: string;
  isGoldMember: boolean;
  adminRole: string | null;
  avatarColor: string;
}

export async function getMobileSession(
  req: NextRequest
): Promise<MobileSession | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const raw = auth.slice(7);

  try {
    const decoded = await decode({
      token: raw,
      secret: process.env.NEXTAUTH_SECRET ?? "",
    });

    if (!decoded?.id) return null;

    return {
      id:            decoded.id            as string,
      screenname:    decoded.screenname    as string,
      isGoldMember:  decoded.isGoldMember  as boolean,
      adminRole:     (decoded.adminRole     as string | null) ?? null,
      avatarColor:   decoded.avatarColor   as string,
    };
  } catch {
    return null;
  }
}
