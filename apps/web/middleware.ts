/**
 * Signoff Chat — Edge Middleware
 *
 * Responsibilities (in order):
 *   1. IP-based rate limiting on auth routes (before any session check)
 *   2. CSRF protection — reject cross-origin state-changing requests
 *   3. Auth guard — redirect unauthenticated users to /login
 *   4. Security response headers on all routes
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, limiters } from "@/lib/ratelimit";
import { getHashedIp } from "@/lib/crypto/ip";

// ---------------------------------------------------------------------------
// Route classification helpers
// ---------------------------------------------------------------------------

/** App pages that require an authenticated session */
function isProtectedPage(pathname: string): boolean {
  // Exclude everything that isn't a user-facing page
  if (
    pathname === "/" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/moderation-policy") ||
    pathname.startsWith("/suspended") ||
    pathname.startsWith("/admin") ||
    pathname === "/favicon.ico"
  ) {
    return false;
  }
  // All remaining paths require auth
  return true;
}

/** Auth endpoints: rate-limited by IP to prevent brute force / enumeration */
function isAuthEndpoint(pathname: string): boolean {
  return (
    pathname === "/api/auth/register" ||
    // NextAuth sign-in action
    pathname === "/api/auth/signin" ||
    pathname === "/api/auth/callback/credentials"
  );
}

/**
 * Routes that need CSRF protection.
 * We check Origin on all state-changing API requests EXCEPT:
 *   - NextAuth (handles CSRF internally via double-submit cookie)
 *   - Stripe webhook (server-to-server, no browser Origin)
 *   - Cron jobs (server-to-server)
 */
function needsCsrfCheck(req: NextRequest): boolean {
  const { method, nextUrl } = req;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  const { pathname } = nextUrl;
  if (!pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/api/auth/")) return false;
  if (pathname.startsWith("/api/stripe/webhook")) return false;
  if (pathname.startsWith("/api/cron/")) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Security headers applied to every response
// ---------------------------------------------------------------------------

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. IP rate limit on auth routes (admin routes have their own guard below) ──
  // Raw IP is hashed immediately — never stored, never logged.
  if (req.method === "POST" && isAuthEndpoint(pathname)) {
    const hashedIp = getHashedIp(req.headers);
    const rl = await rateLimit(limiters.auth, `auth:h:${hashedIp}`);
    if (rl) return addSecurityHeaders(rl);
  }

  // ── 2. CSRF: reject requests with a foreign Origin header ─────────────────
  if (needsCsrfCheck(req)) {
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        const incoming = new URL(origin);

        // In development, allow any localhost origin regardless of port.
        // The port can shift (3000→3001) if another process is already bound.
        const isDev = process.env.NODE_ENV === "development";
        if (isDev && incoming.hostname === "localhost") {
          // allowed — fall through
        } else {
          const expectedRaw = process.env.NEXTAUTH_URL ?? "";
          const expected = new URL(
            expectedRaw.startsWith("http") ? expectedRaw : `https://${expectedRaw}`
          );
          if (incoming.origin !== expected.origin) {
            return addSecurityHeaders(
              NextResponse.json({ error: "forbidden" }, { status: 403 })
            );
          }
        }
      } catch {
        // Malformed NEXTAUTH_URL or Origin — reject to be safe
        return addSecurityHeaders(
          NextResponse.json({ error: "forbidden" }, { status: 403 })
        );
      }
    }
  }

  // ── 3. Boards feature flag — redirect to /feed when disabled ─────────────
  if (pathname.startsWith("/boards")) {
    const flagUrl = new URL("/api/feature-flags/boards", req.url);
    try {
      const flagRes = await fetch(flagUrl);
      const { enabled } = await flagRes.json() as { enabled: boolean };
      if (!enabled) {
        return addSecurityHeaders(NextResponse.redirect(new URL("/feed", req.url)));
      }
    } catch {
      // If the check fails, fail safe — keep boards hidden
      return addSecurityHeaders(NextResponse.redirect(new URL("/feed", req.url)));
    }
  }

  // ── 5. Admin route guard — always 404 for non-admins ────────────────────
  if (pathname.startsWith("/admin")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.adminRole) {
      return addSecurityHeaders(
        new NextResponse(null, { status: 404 })
      );
    }
    // /admin/admins/* requires SUPER_ADMIN
    if (pathname.startsWith("/admin/admins") && token.adminRole !== "SUPER_ADMIN") {
      return addSecurityHeaders(
        new NextResponse(null, { status: 404 })
      );
    }
    // Rate limit admin routes: 60/min
    const hashedIp = getHashedIp(req.headers);
    const rl = await rateLimit(limiters.admin ?? limiters.auth, `admin:${hashedIp}`);
    if (rl) return addSecurityHeaders(rl);
  }

  // ── 6. Auth guard + suspension check for app pages ───────────────────────
  if (isProtectedPage(pathname)) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Suspension check — reads directly from the JWT token.
    // isSuspended is stored at login and refreshed every 5 minutes via the
    // jwt() callback in auth.ts. No API call needed — eliminates per-request
    // DB round-trip for the vast majority of users who are not suspended.
    if (token.isSuspended && !pathname.startsWith("/suspended")) {
      const suspendedPage = new URL("/suspended", req.url);
      if (token.suspendedUntil) {
        suspendedPage.searchParams.set("until", token.suspendedUntil);
      }
      return addSecurityHeaders(NextResponse.redirect(suspendedPage));
    }
  } else if (pathname === "/") {
    // Authenticated users visiting the landing page → send them to the feed
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token) {
      return addSecurityHeaders(NextResponse.redirect(new URL("/feed", req.url)));
    }
  }

  // ── 7. Pass through with security headers ────────────────────────────────
  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (Next.js static assets)
     * - _next/image   (Next.js image optimization)
     * - favicon.ico, *.png, *.jpg, *.svg, *.webp, *.ico (static media)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
