"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Feature table
// ---------------------------------------------------------------------------

interface Feature {
  label: string;
  free: string | boolean;
  gold: string | boolean;
  highlight?: boolean;
}

const FEATURES: Feature[] = [
  { label: "Post feed",                    free: true,          gold: true },
  { label: "Channels & boards",            free: true,          gold: true },
  { label: "Buddy list & DMs",             free: true,          gold: true },
  { label: "Post history",                 free: "90 days",     gold: "unlimited",  highlight: true },
  { label: "Board post history",           free: "90 days",     gold: "unlimited",  highlight: true },
  { label: "Profile photo upload",         free: false,         gold: true,         highlight: true },
  { label: "Custom profile color theme",   free: false,         gold: true,         highlight: true },
  { label: "★ Gold badge everywhere",      free: false,         gold: true,         highlight: true },
  { label: "Custom emoticon packs",        free: false,         gold: "unlocked",   highlight: true },
  { label: "Retro sound packs",            free: false,         gold: "unlocked",   highlight: true },
  { label: "Priority support",             free: false,         gold: true,         highlight: true },
];

// ---------------------------------------------------------------------------
// Cell value renderer
// ---------------------------------------------------------------------------

function Cell({ value, accent }: { value: string | boolean; accent: "muted" | "gold" }) {
  if (value === true) {
    return (
      <span style={{ color: accent === "gold" ? "#c8860a" : "var(--text-muted)" }}>✓</span>
    );
  }
  if (value === false) {
    return <span style={{ color: "var(--text-dim)" }}>–</span>;
  }
  return (
    <span
      className="text-xs font-medium"
      style={{
        color: accent === "gold" ? "#c8860a" : "var(--text-muted)",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CTA button
// ---------------------------------------------------------------------------

function CheckoutButton({ isGold }: { isGold: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "something went wrong.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "something went wrong.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  if (isGold) {
    return (
      <div className="flex flex-col gap-2 items-center">
        <p
          className="text-sm font-semibold"
          style={{ color: "#d4a017", fontFamily: "var(--font-dm-sans)" }}
        >
          you&apos;re gold ★
        </p>
        <button
          onClick={handlePortal}
          disabled={loading}
          className="text-xs font-mono transition-colors disabled:opacity-50"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "var(--amber)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
          }
        >
          {loading ? "loading…" : "manage subscription →"}
        </button>
        {error && (
          <p className="text-[11px] font-mono" style={{ color: "#ef4444" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 items-center">
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full h-11 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-50"
        style={{ background: "var(--amber)", color: "#fff8e6" }}
      >
        {loading ? "loading…" : "Go Gold →"}
      </button>
      <p className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
        $4/month · cancel anytime · no tricks
      </p>
      {error && (
        <p className="text-[11px] font-mono" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UpgradePage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const isGold = session?.user?.isGoldMember ?? false;

  const success = searchParams.get("success") === "1";
  const canceled = searchParams.get("canceled") === "1";

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1
            className="font-vt323 mb-2 select-none"
            style={{ fontSize: 32, color: "var(--amber)" }}
          >
            SIGNOFF GOLD
          </h1>
          <p className="text-base" style={{ color: "var(--text-muted)" }}>
            support the project and unlock a few nice things.
          </p>
        </div>

        {/* Success / canceled banners */}
        {success && (
          <div
            className="rounded-2xl border px-5 py-4 mb-6 text-center"
            style={{
              background: "rgba(200,134,10,0.06)",
              borderColor: "rgba(200,134,10,0.25)",
            }}
          >
            <p className="text-sm font-semibold" style={{ color: "#d4a017" }}>
              ★ welcome to Gold! your badge is live.
            </p>
          </div>
        )}
        {canceled && (
          <div
            className="rounded-2xl border px-5 py-4 mb-6 text-center"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              no worries — you can upgrade anytime.
            </p>
          </div>
        )}

        {/* Two-column comparison */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {/* Free column */}
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="mb-5">
              <h2
                className="text-base font-semibold mb-0.5"
                style={{ color: "var(--text)" }}
              >
                Free
              </h2>
              <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>
                $0
              </p>
              <p className="text-xs font-mono mt-1" style={{ color: "var(--text-muted)" }}>
                forever
              </p>
            </div>

            <ul className="space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-center gap-3">
                  <span className="w-5 text-center flex-shrink-0">
                    <Cell value={f.free} accent="muted" />
                  </span>
                  <span
                    className="text-sm"
                    style={{
                      color: f.free === false ? "var(--text-dim)" : "var(--text-muted)",
                      fontFamily: "var(--font-dm-sans)",
                    }}
                  >
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gold column */}
          <div
            className="rounded-2xl border p-5 relative"
            style={{
              borderColor: "rgba(200,134,10,0.4)",
              background: "var(--surface)",
              boxShadow: "0 0 0 1px rgba(200,134,10,0.15)",
            }}
          >
            {/* Badge */}
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-mono font-bold"
              style={{
                background: "var(--amber)",
                color: "#fff8e6",
              }}
            >
              ★ GOLD
            </div>

            <div className="mb-5">
              <h2
                className="text-base font-semibold mb-0.5"
                style={{ color: "var(--text)" }}
              >
                Gold
              </h2>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-bold" style={{ color: "var(--amber)" }}>
                  $4
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  / month
                </p>
              </div>
              <p className="text-xs font-mono mt-1" style={{ color: "var(--text-muted)" }}>
                cancel anytime
              </p>
            </div>

            <ul className="space-y-2.5 mb-6">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-center gap-3">
                  <span className="w-5 text-center flex-shrink-0">
                    <Cell value={f.gold} accent="gold" />
                  </span>
                  <span
                    className="text-sm"
                    style={{
                      color: f.highlight ? "var(--text)" : "var(--text-muted)",
                      fontFamily: "var(--font-dm-sans)",
                      fontWeight: f.highlight ? 500 : 400,
                    }}
                  >
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>

            {status === "unauthenticated" ? (
              <Link
                href="/login"
                className="block w-full h-11 rounded-xl text-sm font-mono font-bold text-center leading-[44px] transition-all"
                style={{ background: "var(--amber)", color: "#fff8e6" }}
              >
                log in to upgrade →
              </Link>
            ) : status === "authenticated" ? (
              <CheckoutButton isGold={isGold} />
            ) : (
              <div
                className="h-11 rounded-xl animate-pulse"
                style={{ background: "var(--border)" }}
              />
            )}
          </div>
        </div>

        {/* Fine print */}
        <div className="text-center space-y-1">
          <p className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
            payments processed securely by Stripe · no card stored here
          </p>
          <p className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
            questions?{" "}
            <a
              href="mailto:support@signoff.chat"
              className="transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) =>
                ((e.target as HTMLAnchorElement).style.color = "var(--amber)")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLAnchorElement).style.color = "var(--text-muted)")
              }
            >
              support@signoff.chat
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
