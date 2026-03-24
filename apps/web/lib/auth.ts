import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { hashEmail } from "@/lib/crypto/email";

// ---------------------------------------------------------------------------
// Validation helpers — shared between API route and client-side forms
// ---------------------------------------------------------------------------

export function validateScreenname(screenname: string): string | null {
  if (!screenname) return "screenname is required.";
  if (screenname.length < 3 || screenname.length > 20)
    return "screenname must be 3–20 characters.";
  if (!/^[a-zA-Z0-9_]+$/.test(screenname))
    return "screenname can only use letters, numbers, and underscores.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "password is required.";
  if (password.length < 8) return "password must be at least 8 characters.";
  return null;
}

// ---------------------------------------------------------------------------
// Avatar color — deterministic from user id, no DB column needed
// ---------------------------------------------------------------------------

const AVATAR_COLORS = ["amber", "rose", "sky", "emerald", "violet", "orange"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export function deriveAvatarColor(id: string): AvatarColor {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ---------------------------------------------------------------------------
// NextAuth config
// ---------------------------------------------------------------------------

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        screenname: { label: "Screenname", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.screenname || !credentials?.password) {
          throw new Error("screenname and password are required.");
        }

        // Case-insensitive lookup — store original casing, match any casing
        const user = await prisma.user.findFirst({
          where: {
            screenname: { equals: credentials.screenname, mode: "insensitive" },
          },
          select: {
            id: true,
            screenname: true,
            passwordHash: true,
            isGoldMember: true,
            isAdmin: true,
          },
        });

        if (!user) throw new Error("invalid credentials. try again.");

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) throw new Error("invalid credentials. try again.");

        return {
          id: user.id,
          screenname: user.screenname,
          isGoldMember: user.isGoldMember,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; screenname: string; isGoldMember: boolean; isAdmin: boolean };
        token.id = u.id;
        token.screenname = u.screenname;
        token.isGoldMember = u.isGoldMember;
        token.isAdmin = u.isAdmin;
        token.avatarColor = deriveAvatarColor(u.id);
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.screenname = token.screenname;
      session.user.isGoldMember = token.isGoldMember;
      session.user.isAdmin = token.isAdmin;
      session.user.avatarColor = token.avatarColor;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// ---------------------------------------------------------------------------
// Server-side session helper
// ---------------------------------------------------------------------------

export function getSession() {
  return getServerSession(authOptions);
}

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
