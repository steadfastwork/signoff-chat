"use client";

import { useState, useRef, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { RetroWindow, btnStyle, inputStyle, retro, sounds } from "@/components/retro/retro-components";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ?? "";

// Retro "Sign On" window (handoff/PROMPTS.md #3). Keeps the NextAuth credentials
// flow — which now authenticates against OSCAR via the gateway.
function LoginForm() {
  const params = useSearchParams();
  const [screenname, setScreenname] = useState("");
  const [password, setPassword] = useState("");
  const [savePassword, setSavePassword] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  // NextAuth redirects back to /login?error=... on a failed credential sign-in.
  const [error, setError] = useState<string | null>(params.get("error") ? "wrong screenname or password. try again." : null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = useRef<TurnstileInstance>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!screenname.trim() || !password || loading) return;
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("please complete the CAPTCHA.");
      return;
    }
    setLoading(true);
    setError(null);
    sounds.doorOpen();
    // Let NextAuth perform the redirect server-side — more reliable than a
    // client-side router.push after redirect:false (which was leaving users on
    // /login even after a successful sign-in).
    await signIn("credentials", {
      screenname: screenname.trim(),
      password,
      turnstileToken,
      redirect: true,
      callbackUrl: "/messenger",
    });
  }

  const label: React.CSSProperties = { fontFamily: retro.fontMsg, fontStyle: "italic", fontSize: 13, color: retro.inkSoft };
  const checkboxRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: retro.inkSoft, fontFamily: retro.fontUI };

  return (
    <div className="retro-desktop" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <RetroWindow title="Sign On" width={340}>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Brand plaque */}
          <div style={{ background: retro.gradient, borderRadius: 6, padding: "14px 12px", textAlign: "center" }}>
            <div style={{ fontFamily: retro.fontBrand, fontSize: 30, letterSpacing: 2, color: retro.gold, lineHeight: 1 }}>SIGNOFF.CHAT</div>
            <div style={{ fontFamily: retro.fontMsg, fontStyle: "italic", fontSize: 13, color: "#e7ecff", marginTop: 4 }}>Online Messenger&trade;</div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }} noValidate>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label}><span style={{ color: retro.red }}>&#128273;</span> ScreenName</span>
              <input
                value={screenname}
                onChange={(e) => setScreenname(e.target.value)}
                autoCapitalize="none"
                autoComplete="username"
                spellCheck={false}
                disabled={loading}
                style={{ ...inputStyle, height: 36, fontWeight: "bold", color: retro.blue }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label}>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                style={{ ...inputStyle, height: 36 }}
              />
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <label style={checkboxRow}><input type="checkbox" checked={savePassword} onChange={(e) => setSavePassword(e.target.checked)} /> Save password</label>
              <label style={checkboxRow}><input type="checkbox" checked={autoLogin} onChange={(e) => setAutoLogin(e.target.checked)} /> Auto-login</label>
            </div>

            {TURNSTILE_SITE_KEY && (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Turnstile ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken("")} options={{ size: "normal" }} />
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: retro.red, textAlign: "center", fontFamily: retro.fontUI }}>{error}</div>}

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="submit"
                disabled={loading || !screenname.trim() || !password}
                style={{ ...btnStyle, height: 34, padding: "0 26px", fontSize: 13, color: retro.greenDeep, border: `2px solid ${retro.green}`, background: loading ? "#eef7f0" : retro.chrome, opacity: loading || !screenname.trim() || !password ? 0.55 : 1 }}
              >
                {loading ? "Signing On…" : "Sign On"}
              </button>
            </div>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${retro.hairline}`, paddingTop: 10, fontSize: 11, fontFamily: retro.fontMono, color: retro.inkMuted }}>
            <span>v5.0 &middot; TOC2</span>
            <Link href="/register" style={{ color: retro.blue, textDecoration: "underline" }}>Get a screen name</Link>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
