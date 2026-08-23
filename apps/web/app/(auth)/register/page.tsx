"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RetroWindow, btnStyle, inputStyle, retro, sounds } from "@/components/retro/retro-components";

// Retro "Get a Screen Name" window. Creates an AIM/ICQ account on OSCAR via
// /api/auth/register, then signs in. Screenname + password only — no email.
export default function RegisterPage() {
  const router = useRouter();
  const [screenname, setScreenname] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(screenname.trim())) {
      setError("screenname must be 3–20 letters, numbers, or _");
      return;
    }
    if (password.length < 8) {
      setError("password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("passwords don't match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ screenname: screenname.trim(), password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "could not create account");
        setLoading(false);
        return;
      }
      // Auto sign-in.
      const result = await signIn("credentials", { screenname: screenname.trim(), password, redirect: false });
      setLoading(false);
      if (result?.error) {
        setError("account created — please sign in.");
        router.push("/login");
        return;
      }
      sounds.doorOpen();
      router.push("/messenger");
      router.refresh();
    } catch {
      setLoading(false);
      setError("something went wrong. try again.");
    }
  }

  const label: React.CSSProperties = { fontFamily: retro.fontMsg, fontStyle: "italic", fontSize: 13, color: retro.inkSoft };

  return (
    <div className="retro-desktop" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <RetroWindow title="Get a Screen Name" width={340}>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: retro.gradient, borderRadius: 6, padding: "14px 12px", textAlign: "center" }}>
            <div style={{ fontFamily: retro.fontBrand, fontSize: 30, letterSpacing: 2, color: retro.gold, lineHeight: 1 }}>SIGNOFF.CHAT</div>
            <div style={{ fontFamily: retro.fontMsg, fontStyle: "italic", fontSize: 13, color: "#e7ecff", marginTop: 4 }}>Online Messenger&trade;</div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }} noValidate>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label}>Choose a ScreenName</span>
              <input value={screenname} onChange={(e) => setScreenname(e.target.value)} autoCapitalize="none" autoComplete="username" spellCheck={false} disabled={loading} style={{ ...inputStyle, height: 36, fontWeight: "bold", color: retro.blue }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label}>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" disabled={loading} style={{ ...inputStyle, height: 36 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label}>Confirm Password</span>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" disabled={loading} style={{ ...inputStyle, height: 36 }} />
            </div>

            {error && <div style={{ fontSize: 12, color: retro.red, textAlign: "center", fontFamily: retro.fontUI }}>{error}</div>}

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button type="submit" disabled={loading || !screenname.trim() || !password} style={{ ...btnStyle, height: 34, padding: "0 22px", fontSize: 13, color: retro.greenDeep, border: `2px solid ${retro.green}`, opacity: loading || !screenname.trim() || !password ? 0.55 : 1 }}>
                {loading ? "Creating…" : "Sign On"}
              </button>
            </div>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${retro.hairline}`, paddingTop: 10, fontSize: 11, fontFamily: retro.fontMono, color: retro.inkMuted }}>
            <span>free forever</span>
            <Link href="/login" style={{ color: retro.blue, textDecoration: "underline" }}>Already have one? Sign On</Link>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
