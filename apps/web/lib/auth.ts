import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { hashEmail } from "@/lib/crypto/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { isRadicalUXEnabled } from "@/lib/featureFlags";

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
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        screenname: { label: "Screenname", type: "text" },
        password: { label: "Password", type: "password" },
        turnstileToken: { label: "Turnstile", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.screenname || !credentials?.password) {
          throw new Error("screenname and password are required.");
        }

        const captchaOk = await verifyTurnstile(credentials.turnstileToken ?? "");
        if (!captchaOk) throw new Error("CAPTCHA_FAILED");

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
            adminRole: true,
            isSuspended: true,
            suspendedUntil: true,
            onboardingComplete: true,
            onboardingStep: true,
            emailVerified: true,
          },
        });

        if (!user) throw new Error("invalid credentials. try again.");

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) throw new Error("invalid credentials. try again.");

        if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

        // Auto-lift expired temporary suspensions at login time
        let isSuspended = user.isSuspended;
        let suspendedUntil = user.suspendedUntil;
        if (isSuspended && suspendedUntil && new Date(suspendedUntil) < new Date()) {
          await prisma.user.update({
            where: { id: user.id },
            data: { isSuspended: false, suspendedUntil: null },
          });
          isSuspended = false;
          suspendedUntil = null;
        }

        return {
          id: user.id,
          screenname: user.screenname,
          isGoldMember: user.isGoldMember,
          adminRole: user.adminRole ?? null,
          isSuspended,
          suspendedUntil: suspendedUntil?.toISOString() ?? null,
          onboardingComplete: user.onboardingComplete,
          onboardingStep: user.onboardingStep,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user, trigger }) {
      // ── Initial sign-in: populate from authorize() return value ───────────
      if (user) {
        const u = user as {
          id: string; screenname: string; isGoldMember: boolean;
          adminRole: string | null; isSuspended: boolean; suspendedUntil: string | null;
          onboardingComplete: boolean; onboardingStep: number;
        };
        token.id                 = u.id;
        token.screenname         = u.screenname;
        token.isGoldMember       = u.isGoldMember;
        token.adminRole          = u.adminRole ?? null;
        token.avatarColor        = deriveAvatarColor(u.id);
        token.isSuspended        = u.isSuspended;
        token.suspendedUntil     = u.suspendedUntil;
        token.suspensionCheckedAt = Date.now();
        token.onboardingComplete = u.onboardingComplete;
        token.onboardingStep     = u.onboardingStep;
        return token;
      }

      // ── Force refresh on useSession().update() — e.g. after onboarding ───
      if (trigger === "update") {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id },
            select: { isSuspended: true, suspendedUntil: true, adminRole: true, isGoldMember: true, onboardingComplete: true, onboardingStep: true },
          });
          if (fresh) {
            token.isSuspended        = fresh.isSuspended;
            token.suspendedUntil     = fresh.suspendedUntil?.toISOString() ?? null;
            token.adminRole          = fresh.adminRole ?? null;
            token.isGoldMember       = fresh.isGoldMember;
            token.onboardingComplete = fresh.onboardingComplete;
            token.onboardingStep     = fresh.onboardingStep;
            token.suspensionCheckedAt = Date.now();
          }
        } catch { /* keep cached value */ }
        return token;
      }

      // ── Subsequent calls: re-check suspension every 5 minutes ─────────────
      // This runs when getServerSession() is called from a Server Component or
      // API route. It refreshes the token so middleware can trust the cached value.
      const FIVE_MIN = 5 * 60 * 1000;
      if (Date.now() - (token.suspensionCheckedAt ?? 0) > FIVE_MIN) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: token.id },
            select: { isSuspended: true, suspendedUntil: true, adminRole: true, isGoldMember: true, onboardingComplete: true, onboardingStep: true },
          });
          if (user) {
            // Auto-lift expired suspension
            if (user.isSuspended && user.suspendedUntil && new Date(user.suspendedUntil) < new Date()) {
              await prisma.user.update({
                where: { id: token.id },
                data: { isSuspended: false, suspendedUntil: null },
              });
              token.isSuspended    = false;
              token.suspendedUntil = null;
            } else {
              token.isSuspended    = user.isSuspended;
              token.suspendedUntil = user.suspendedUntil?.toISOString() ?? null;
            }
            token.adminRole          = user.adminRole ?? null;
            token.isGoldMember       = user.isGoldMember;
            token.onboardingComplete = user.onboardingComplete;
            token.onboardingStep     = user.onboardingStep;
          }
        } catch { /* DB unavailable — keep cached value */ }
        token.suspensionCheckedAt = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id           = token.id;
      session.user.screenname   = token.screenname;
      session.user.isGoldMember = token.isGoldMember;
      session.user.adminRole    = token.adminRole;
      session.user.avatarColor  = token.avatarColor;
      // Embed flag state so client components can read it via useSession()
      // without a separate API call. getFeatureFlag() uses React.cache() so
      // this is at most one DB query per request even if called from multiple places.
      session.radicalUXEnabled  = await isRadicalUXEnabled(token.id);
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
