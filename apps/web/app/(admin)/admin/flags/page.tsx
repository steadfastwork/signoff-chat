"use client";

import { useEffect, useState } from "react";

interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  enabledAt: string | null;
  enabledBy: string | null;
  updatedAt: string;
  rolloutPercent: number;
}

const CARD_STYLES = {
  root: {
    background: "#0a0a09",
    border: "1px solid #1a1916",
    borderRadius: 8,
    padding: "20px 24px",
    maxWidth: 560,
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  } as React.CSSProperties,
  title: {
    fontFamily: "IBM Plex Mono, monospace",
    fontSize: 15,
    fontWeight: 600,
    color: "#e8ddd0",
    marginBottom: 4,
  } as React.CSSProperties,
  desc: {
    fontFamily: "IBM Plex Mono, monospace",
    fontSize: 12,
    color: "#6b6456",
    lineHeight: 1.5,
  } as React.CSSProperties,
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 12,
    borderTop: "1px solid #1a1916",
  } as React.CSSProperties,
};

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        color: enabled ? "#4ade80" : "#8a7d6e",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: enabled ? "#4ade80" : "#3a3530",
          flexShrink: 0,
        }}
      />
      {enabled ? "LIVE" : "DISABLED"}
    </span>
  );
}

function ConfirmDialog({
  flag,
  targetEnabled,
  onConfirm,
  onCancel,
  loading,
}: {
  flag: FeatureFlag;
  targetEnabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [input, setInput] = useState("");
  const confirmPhrase = targetEnabled ? "ENABLE BOARDS" : undefined;
  const canConfirm = targetEnabled ? input === confirmPhrase : true;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#0d0d0b",
          border: "1px solid #2a2620",
          borderRadius: 10,
          padding: "28px 28px 24px",
          maxWidth: 420,
          width: "100%",
        }}
      >
        <h2
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 14,
            fontWeight: 700,
            color: "#e8ddd0",
            marginBottom: 12,
          }}
        >
          {targetEnabled ? "Enable Boards for all users?" : "Disable Boards?"}
        </h2>
        <p
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 12,
            color: "#8a7d6e",
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          {targetEnabled
            ? "This will immediately make Boards visible to every user on the platform. Make sure you've tested the feature thoroughly before enabling it in production."
            : "Users will lose access to Boards immediately. Their posts and data are preserved — this only hides the feature. You can re-enable at any time."}
        </p>

        {targetEnabled && (
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 11,
                color: "#6b6456",
                marginBottom: 6,
              }}
            >
              Type <strong style={{ color: "#c8860a" }}>ENABLE BOARDS</strong> to confirm
            </label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ENABLE BOARDS"
              autoFocus
              style={{
                width: "100%",
                background: "#0a0a09",
                border: "1px solid #2a2620",
                borderRadius: 6,
                padding: "8px 12px",
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 13,
                color: "#e8ddd0",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              background: "transparent",
              border: "1px solid #2a2620",
              borderRadius: 6,
              padding: "8px 16px",
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
              color: "#8a7d6e",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm || loading}
            style={{
              background: targetEnabled
                ? canConfirm
                  ? "rgba(200,134,10,0.2)"
                  : "rgba(200,134,10,0.05)"
                : "rgba(239,68,68,0.15)",
              border: `1px solid ${targetEnabled ? (canConfirm ? "#c8860a" : "#3a2e10") : "#ef4444"}`,
              borderRadius: 6,
              padding: "8px 18px",
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
              fontWeight: 700,
              color: targetEnabled
                ? canConfirm
                  ? "#c8860a"
                  : "#5a4a20"
                : "#ef4444",
              cursor: canConfirm && !loading ? "pointer" : "not-allowed",
              opacity: canConfirm && !loading ? 1 : 0.5,
            }}
          >
            {loading ? "Saving…" : targetEnabled ? "Enable Boards" : "Disable"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RadicalUXCard — special card for the RADICAL_UX flag with rollout slider
// ---------------------------------------------------------------------------

function RadicalUXCard({
  flag,
  isSuperAdmin,
  onToggle,
  onRollout,
}: {
  flag: FeatureFlag;
  isSuperAdmin: boolean;
  onToggle: (key: string, enabled: boolean) => void;
  onRollout: (pct: number) => void;
}) {
  const [sliderValue, setSliderValue] = useState(flag.rolloutPercent ?? 0);
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseInt(e.target.value, 10);
    setSliderValue(pct);
    if (saveTimeout) clearTimeout(saveTimeout);
    const t = setTimeout(async () => {
      setSaving(true);
      await onRollout(pct);
      setSaving(false);
    }, 600);
    setSaveTimeout(t);
  };

  const relativeTime = (iso: string | null) => {
    if (!iso) return "never";
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div
      style={{
        background: "#0a0a09",
        border: "1px solid rgba(200,134,10,0.25)",
        borderRadius: 8,
        padding: "20px 24px",
        maxWidth: 560,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 15, fontWeight: 600, color: "#e8ddd0", marginBottom: 4 }}>
            🧪 {flag.key}
          </div>
          {flag.description && (
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#6b6456", lineHeight: 1.5 }}>
              {flag.description}
            </div>
          )}
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#4a4030", marginTop: 4 }}>
            Kill switch: set{" "}
            <code style={{ color: "#8a6a20", background: "rgba(200,134,10,0.08)", padding: "1px 5px", borderRadius: 3 }}>
              DISABLE_RADICAL_UX=true
            </code>{" "}
            env var to override.
          </div>
        </div>
        <StatusBadge enabled={flag.enabled} />
      </div>

      {/* Rollout slider */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#6b6456" }}>
            Gradual rollout
          </label>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, fontWeight: 700, color: flag.enabled ? "#c8860a" : "#4a4030" }}>
            {sliderValue}%{saving && <span style={{ color: "#6b6456", fontWeight: 400, marginLeft: 6 }}>saving…</span>}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={sliderValue}
          disabled={!isSuperAdmin || !flag.enabled}
          onChange={handleSliderChange}
          style={{
            width: "100%",
            accentColor: "#c8860a",
            opacity: !isSuperAdmin || !flag.enabled ? 0.35 : 1,
            cursor: !isSuperAdmin || !flag.enabled ? "not-allowed" : "pointer",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: "#3a3530" }}>0 — no users</span>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: "#3a3530" }}>100 — everyone</span>
        </div>
        {!flag.enabled && (
          <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#4a4030", marginTop: 6 }}>
            Enable the flag first to activate rollout.
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 12, borderTop: "1px solid #1a1916" }}>
        <div>
          {flag.enabled && flag.enabledBy ? (
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#6b6456" }}>
              Enabled by {flag.enabledBy} · {relativeTime(flag.enabledAt)}
            </span>
          ) : (
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#3a3530" }}>
              {flag.enabledAt ? `Disabled · last enabled ${relativeTime(flag.enabledAt)}` : "Never enabled"}
            </span>
          )}
        </div>

        {isSuperAdmin ? (
          flag.enabled ? (
            <button
              onClick={() => onToggle(flag.key, false)}
              style={{
                background: "transparent",
                border: "1px solid #2a2620",
                borderRadius: 6,
                padding: "6px 14px",
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 12,
                color: "#ef4444",
                cursor: "pointer",
              }}
            >
              Disable →
            </button>
          ) : (
            <button
              onClick={() => onToggle(flag.key, true)}
              style={{
                background: "rgba(200,134,10,0.12)",
                border: "1px solid rgba(200,134,10,0.4)",
                borderRadius: 6,
                padding: "6px 14px",
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 12,
                color: "#c8860a",
                cursor: "pointer",
              }}
            >
              Enable →
            </button>
          )
        ) : (
          <span
            title="Only super admins can toggle features"
            style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#3a3530", cursor: "not-allowed" }}
          >
            {flag.enabled ? "Disable →" : "Enable →"} (super admin only)
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FlagCard({
  flag,
  isSuperAdmin,
  onToggle,
}: {
  flag: FeatureFlag;
  isSuperAdmin: boolean;
  onToggle: (key: string, enabled: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [targetEnabled, setTargetEnabled] = useState(false);

  const startToggle = (enable: boolean) => {
    setTargetEnabled(enable);
    setConfirming(true);
  };

  const relativeTime = (iso: string | null) => {
    if (!iso) return "never";
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <>
      <div style={CARD_STYLES.root}>
        <div style={CARD_STYLES.header}>
          <div>
            <div style={CARD_STYLES.title}>📌 {flag.key}</div>
            {flag.description && (
              <div style={CARD_STYLES.desc}>{flag.description}</div>
            )}
          </div>
          <StatusBadge enabled={flag.enabled} />
        </div>

        <div style={CARD_STYLES.footer}>
          <div>
            {flag.enabled && flag.enabledBy ? (
              <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#6b6456" }}>
                Enabled by {flag.enabledBy} · {relativeTime(flag.enabledAt)}
              </span>
            ) : (
              <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#3a3530" }}>
                {flag.enabledAt ? `Disabled · last enabled ${relativeTime(flag.enabledAt)}` : "Never enabled"}
              </span>
            )}
          </div>

          {isSuperAdmin ? (
            flag.enabled ? (
              <button
                onClick={() => startToggle(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #2a2620",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 12,
                  color: "#ef4444",
                  cursor: "pointer",
                }}
              >
                Disable →
              </button>
            ) : (
              <button
                onClick={() => startToggle(true)}
                style={{
                  background: "rgba(200,134,10,0.12)",
                  border: "1px solid rgba(200,134,10,0.4)",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 12,
                  color: "#c8860a",
                  cursor: "pointer",
                }}
              >
                Enable →
              </button>
            )
          ) : (
            <span
              title="Only super admins can toggle features"
              style={{
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 11,
                color: "#3a3530",
                cursor: "not-allowed",
              }}
            >
              {flag.enabled ? "Disable →" : "Enable →"} (super admin only)
            </span>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          flag={flag}
          targetEnabled={targetEnabled}
          loading={false}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onToggle(flag.key, targetEnabled);
          }}
        />
      )}
    </>
  );
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check role from admin page title context (session is available via cookie)
    Promise.all([
      fetch("/api/admin/flags").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/auth/session").then((r) => r.json()),
    ])
      .then(([flagsData, session]) => {
        if (flagsData?.flags) setFlags(flagsData.flags);
        if (session?.user?.adminRole === "SUPER_ADMIN") setIsSuperAdmin(true);
      })
      .catch(() => setError("Failed to load flags."))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: string, enabled: boolean) => {
    setError(null);
    const res = await fetch("/api/admin/flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, enabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update flag.");
      return;
    }
    const { flag } = await res.json();
    setFlags((prev) => prev.map((f) => (f.key === flag.key ? flag : f)));
  };

  const handleRollout = async (key: string, rolloutPercent: number) => {
    setError(null);
    const res = await fetch("/api/admin/flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, rolloutPercent }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update rollout percent.");
      return;
    }
    const { flag } = await res.json();
    setFlags((prev) => prev.map((f) => (f.key === flag.key ? flag : f)));
  };

  return (
    <div style={{ padding: "32px 28px", maxWidth: 640 }}>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 18,
            fontWeight: 700,
            color: "#e8ddd0",
            marginBottom: 6,
          }}
        >
          Feature flags
        </h1>
        <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#6b6456", lineHeight: 1.6 }}>
          Enable or disable features platform-wide.
          Changes take effect immediately for all users.
        </p>
      </div>

      {error && (
        <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#ef4444", marginBottom: 16 }}>
          {error}
        </p>
      )}

      {loading ? (
        <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#6b6456" }}>
          Loading…
        </p>
      ) : flags.length === 0 ? (
        <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#6b6456" }}>
          No feature flags found.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {flags.map((flag) =>
            flag.key === "RADICAL_UX" ? (
              <RadicalUXCard
                key={flag.key}
                flag={flag}
                isSuperAdmin={isSuperAdmin}
                onToggle={handleToggle}
                onRollout={(pct) => handleRollout(flag.key, pct)}
              />
            ) : (
              <FlagCard
                key={flag.key}
                flag={flag}
                isSuperAdmin={isSuperAdmin}
                onToggle={handleToggle}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
