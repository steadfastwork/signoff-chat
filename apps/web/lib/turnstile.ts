/**
 * Cloudflare Turnstile — server-side token verification.
 *
 * Pass-through (returns true) when CLOUDFLARE_TURNSTILE_SECRET_KEY is not set,
 * so local dev without Turnstile configured works without changes.
 *
 * Test keys for staging:
 *   Site key:   1x00000000000000000000AA  (always passes)
 *   Secret key: 1x0000000000000000000000000000000AA  (always passes)
 */

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Dev pass-through

  if (!token) return false;

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, response: token }),
      }
    );
    const data = (await res.json()) as TurnstileVerifyResponse;
    return data.success === true;
  } catch {
    return false;
  }
}
