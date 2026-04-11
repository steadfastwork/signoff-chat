"use client";

import { useEffect, useState, useRef } from "react";
import { BADGE_CONFIG, BADGE_ORDER, FOUNDER_CAP, type BadgeType } from "@/lib/badges";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BadgeAward {
  id: string;
  badge: BadgeType;
  awardedAt: string;
  awardedById: string;
  note: string | null;
  user: { screenname: string; isGoldMember: boolean };
}

// ---------------------------------------------------------------------------
// Confirm revoke modal
// ---------------------------------------------------------------------------

function RevokeModal({
  award,
  onConfirm,
  onCancel,
  loading,
}: {
  award: BadgeAward;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const cfg = BADGE_CONFIG[award.badge];
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
          maxWidth: 400,
          width: "100%",
        }}
      >
        <h2
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 14,
            fontWeight: 700,
            color: "#e8ddd0",
            marginBottom: 10,
          }}
        >
          Revoke {cfg.emoji} {cfg.label} badge?
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
          This will permanently remove the <strong style={{ color: cfg.color }}>{cfg.label}</strong> badge from{" "}
          <strong style={{ color: "#e8ddd0" }}>@{award.user.screenname}</strong>. This action is logged.
        </p>
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
            disabled={loading}
            style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid #ef4444",
              borderRadius: 6,
              padding: "8px 18px",
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
              fontWeight: 700,
              color: "#ef4444",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Revoking…" : "Revoke badge"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BadgesPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [awards, setAwards] = useState<BadgeAward[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [founderCount, setFounderCount] = useState(0);
  const [donorCount, setDonorCount] = useState(0);

  // Tab / filter
  const [tab, setTab] = useState<"all" | BadgeType>("all");
  const [search, setSearch] = useState("");

  // Award form
  const [formScreenname, setFormScreenname] = useState("");
  const [formBadge, setFormBadge] = useState<BadgeType>("FOUNDER");
  const [formNote, setFormNote] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);
  const [awardSuccess, setAwardSuccess] = useState<string | null>(null);

  // User search dropdown
  const [userSuggestions, setUserSuggestions] = useState<{ screenname: string }[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Revoke
  const [revoking, setRevoking] = useState<BadgeAward | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Cursor pagination
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (s?.user?.adminRole === "SUPER_ADMIN") setIsSuperAdmin(true);
      })
      .catch(() => {});
  }, []);

  const loadAwards = (reset = true) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (tab !== "all") params.set("badge", tab);
    if (search) params.set("search", search);
    if (!reset && cursor) params.set("cursor", cursor);

    fetch(`/api/admin/badges?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const newAwards: BadgeAward[] = data.awards ?? [];
        setAwards(reset ? newAwards : (prev) => [...prev, ...newAwards]);
        setTotal(data.total ?? 0);
        setHasMore(newAwards.length === 50);
        if (newAwards.length > 0) setCursor(newAwards[newAwards.length - 1].id);
        // Update stats
        const founderTotal = data.awards?.filter((a: BadgeAward) => a.badge === "FOUNDER").length ?? 0;
        const donorTotal = data.awards?.filter((a: BadgeAward) => a.badge === "FOUNDING_DONOR").length ?? 0;
        if (reset) {
          // Fetch all for stats
          fetch("/api/admin/badges?badge=FOUNDER")
            .then((r) => r.json())
            .then((d) => setFounderCount(d.total ?? 0))
            .catch(() => {});
          fetch("/api/admin/badges?badge=FOUNDING_DONOR")
            .then((r) => r.json())
            .then((d) => setDonorCount(d.total ?? 0))
            .catch(() => {});
        }
      })
      .catch(() => setError("Failed to load badges."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setCursor(null);
    loadAwards(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

  const handleScreennameInput = (val: string) => {
    setFormScreenname(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (val.trim().length < 2) {
      setUserSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    searchDebounceRef.current = setTimeout(() => {
      fetch(`/api/admin/users?search=${encodeURIComponent(val)}`)
        .then((r) => r.json())
        .then((d) => {
          const users = (d.users ?? []).slice(0, 5);
          setUserSuggestions(users);
          setSuggestionsOpen(true);
        })
        .catch(() => {});
    }, 250);
  };

  const handleAward = async () => {
    if (!formScreenname.trim() || awarding) return;
    setAwarding(true);
    setAwardError(null);
    setAwardSuccess(null);
    try {
      const res = await fetch("/api/admin/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenname: formScreenname.trim(),
          badge: formBadge,
          note: formNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAwardError(data.error ?? "Failed to award badge.");
      } else {
        setAwardSuccess(`${BADGE_CONFIG[formBadge].emoji} ${BADGE_CONFIG[formBadge].label} badge awarded to @${formScreenname.trim()}.`);
        setFormScreenname("");
        setFormNote("");
        loadAwards(true);
      }
    } catch {
      setAwardError("Network error.");
    } finally {
      setAwarding(false);
    }
  };

  const handleRevoke = async () => {
    if (!revoking) return;
    setRevokingId(revoking.id);
    try {
      const res = await fetch(`/api/admin/badges/${revoking.id}`, { method: "DELETE" });
      if (res.ok) {
        setAwards((prev) => prev.filter((a) => a.id !== revoking.id));
        setTotal((t) => t - 1);
        if (revoking.badge === "FOUNDER") setFounderCount((c) => c - 1);
        if (revoking.badge === "FOUNDING_DONOR") setDonorCount((c) => c - 1);
      } else {
        setError("Failed to revoke badge.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setRevokingId(null);
      setRevoking(null);
    }
  };

  const relativeTime = (iso: string) => {
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
    <div style={{ padding: "32px 28px", maxWidth: 900 }}>
      {/* Header */}
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
          ⚡ Badges
        </h1>
        <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#6b6456", lineHeight: 1.6 }}>
          Award and revoke special badges. Only super admins can award or revoke. Admins can view.
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        {/* Founder stat */}
        <div
          style={{
            background: "#0a0a09",
            border: "1px solid #1a1916",
            borderRadius: 8,
            padding: "16px 20px",
            flex: 1,
          }}
        >
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#6b6456", marginBottom: 8 }}>
            FOUNDER
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, fontWeight: 700, color: "#c8860a" }}>
              {founderCount}
            </span>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#6b6456" }}>
              / {FOUNDER_CAP}
            </span>
          </div>
          {/* Progress bar */}
          <div
            style={{
              height: 4,
              background: "#1a1916",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min((founderCount / FOUNDER_CAP) * 100, 100)}%`,
                background: "#c8860a",
                borderRadius: 2,
                transition: "width 0.3s",
              }}
            />
          </div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: "#3a3530", marginTop: 4 }}>
            {FOUNDER_CAP - founderCount} spots remaining
          </div>
        </div>

        {/* Founding Donor stat */}
        <div
          style={{
            background: "#0a0a09",
            border: "1px solid #1a1916",
            borderRadius: 8,
            padding: "16px 20px",
            flex: 1,
          }}
        >
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#6b6456", marginBottom: 8 }}>
            FOUNDING DONOR
          </div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, fontWeight: 700, color: "#a78bfa" }}>
            {donorCount}
          </div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: "#3a3530", marginTop: 4 }}>
            no cap
          </div>
        </div>
      </div>

      {/* Award form — super admin only */}
      {isSuperAdmin ? (
        <div
          style={{
            background: "#0a0a09",
            border: "1px solid #1a1916",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 13,
              fontWeight: 600,
              color: "#e8ddd0",
              marginBottom: 16,
            }}
          >
            Award a badge
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            {/* Screenname input with dropdown */}
            <div style={{ position: "relative", flex: "1 1 180px" }}>
              <label
                style={{
                  display: "block",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 10,
                  color: "#6b6456",
                  marginBottom: 4,
                }}
              >
                SCREENNAME
              </label>
              <input
                value={formScreenname}
                onChange={(e) => handleScreennameInput(e.target.value)}
                onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                onFocus={() => userSuggestions.length > 0 && setSuggestionsOpen(true)}
                placeholder="screenname"
                style={{
                  width: "100%",
                  background: "#0d0d0b",
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
              {suggestionsOpen && userSuggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "#0d0d0b",
                    border: "1px solid #2a2620",
                    borderRadius: 6,
                    overflow: "hidden",
                    zIndex: 50,
                    marginTop: 2,
                  }}
                >
                  {userSuggestions.map((u) => (
                    <button
                      key={u.screenname}
                      onMouseDown={() => {
                        setFormScreenname(u.screenname);
                        setSuggestionsOpen(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: 12,
                        color: "#e8ddd0",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background = "#1a1916")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                      }
                    >
                      @{u.screenname}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Badge selector */}
            <div style={{ flex: "1 1 160px" }}>
              <label
                style={{
                  display: "block",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 10,
                  color: "#6b6456",
                  marginBottom: 4,
                }}
              >
                BADGE
              </label>
              <select
                value={formBadge}
                onChange={(e) => setFormBadge(e.target.value as BadgeType)}
                style={{
                  width: "100%",
                  background: "#0d0d0b",
                  border: "1px solid #2a2620",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 13,
                  color: "#e8ddd0",
                  outline: "none",
                  boxSizing: "border-box",
                  cursor: "pointer",
                }}
              >
                {BADGE_ORDER.map((b) => (
                  <option key={b} value={b}>
                    {BADGE_CONFIG[b].emoji} {BADGE_CONFIG[b].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Note input */}
            <div style={{ flex: "2 1 220px" }}>
              <label
                style={{
                  display: "block",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 10,
                  color: "#6b6456",
                  marginBottom: 4,
                }}
              >
                NOTE (optional)
              </label>
              <input
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="internal note…"
                style={{
                  width: "100%",
                  background: "#0d0d0b",
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

            {/* Award button */}
            <div>
              <div style={{ height: 18 }} />
              <button
                onClick={handleAward}
                disabled={!formScreenname.trim() || awarding}
                style={{
                  background: formScreenname.trim() ? "rgba(200,134,10,0.2)" : "rgba(200,134,10,0.05)",
                  border: `1px solid ${formScreenname.trim() ? "#c8860a" : "#3a2e10"}`,
                  borderRadius: 6,
                  padding: "8px 18px",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  color: formScreenname.trim() ? "#c8860a" : "#5a4a20",
                  cursor: formScreenname.trim() && !awarding ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap",
                }}
              >
                {awarding ? "Awarding…" : "Award badge"}
              </button>
            </div>
          </div>

          {awardError && (
            <p
              style={{
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 12,
                color: "#ef4444",
                marginTop: 12,
              }}
            >
              {awardError}
            </p>
          )}
          {awardSuccess && (
            <p
              style={{
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 12,
                color: "#4ade80",
                marginTop: 12,
              }}
            >
              {awardSuccess}
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            background: "#0a0a09",
            border: "1px solid #1a1916",
            borderRadius: 8,
            padding: "16px 20px",
            marginBottom: 28,
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 12,
            color: "#3a3530",
          }}
        >
          Only super admins can award or revoke badges.
        </div>
      )}

      {/* Badge list */}
      <div>
        {/* Tabs + search row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "FOUNDER", "FOUNDING_DONOR"] as const).map((t) => {
              const active = tab === t;
              const label =
                t === "all" ? "All" : `${BADGE_CONFIG[t].emoji} ${BADGE_CONFIG[t].label}`;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: 12,
                    fontWeight: active ? 700 : 400,
                    color: active ? "#c8860a" : "#8a7d6e",
                    background: active ? "rgba(200,134,10,0.1)" : "transparent",
                    border: `1px solid ${active ? "rgba(200,134,10,0.4)" : "#1a1916"}`,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search screenname…"
            style={{
              background: "#0a0a09",
              border: "1px solid #1a1916",
              borderRadius: 6,
              padding: "5px 10px",
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
              color: "#e8ddd0",
              outline: "none",
              flex: 1,
              maxWidth: 220,
            }}
          />

          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 11,
              color: "#3a3530",
              marginLeft: "auto",
            }}
          >
            {total} total
          </span>
        </div>

        {error && (
          <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#ef4444", marginBottom: 12 }}>
            {error}
          </p>
        )}

        {loading ? (
          <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#6b6456" }}>Loading…</p>
        ) : awards.length === 0 ? (
          <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#3a3530" }}>No badges awarded yet.</p>
        ) : (
          <>
            {/* Table */}
            <div
              style={{
                background: "#0a0a09",
                border: "1px solid #1a1916",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 160px 120px 120px 1fr 40px",
                  padding: "10px 16px",
                  borderBottom: "1px solid #1a1916",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  color: "#6b6456",
                  textTransform: "uppercase",
                }}
              >
                <span>Screenname</span>
                <span>Badge</span>
                <span>Awarded</span>
                <span>Awarded by</span>
                <span>Note</span>
                <span></span>
              </div>

              {/* Rows */}
              {awards.map((award) => {
                const cfg = BADGE_CONFIG[award.badge];
                return (
                  <div
                    key={award.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 160px 120px 120px 1fr 40px",
                      padding: "10px 16px",
                      borderBottom: "1px solid #0f0f0e",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.015)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background = "transparent")
                    }
                  >
                    <span
                      style={{
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: 13,
                        color: "#e8ddd0",
                      }}
                    >
                      @{award.user.screenname}
                      {award.user.isGoldMember && (
                        <span style={{ color: "#c8860a", marginLeft: 4 }}>★</span>
                      )}
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        fontFamily: "IBM Plex Mono, monospace",
                        color: cfg.color,
                      }}
                    >
                      {cfg.emoji} {cfg.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: 11,
                        color: "#6b6456",
                      }}
                    >
                      {relativeTime(award.awardedAt)}
                    </span>
                    <span
                      style={{
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: 11,
                        color: "#6b6456",
                      }}
                    >
                      @{award.awardedById}
                    </span>
                    <span
                      style={{
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: 11,
                        color: "#3a3530",
                        fontStyle: award.note ? "normal" : "italic",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {award.note ?? "—"}
                    </span>
                    <div>
                      {isSuperAdmin && (
                        <button
                          onClick={() => setRevoking(award)}
                          title="Revoke badge"
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: "4px 6px",
                            fontFamily: "IBM Plex Mono, monospace",
                            fontSize: 13,
                            color: "#3a3530",
                            cursor: "pointer",
                            borderRadius: 4,
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color = "#3a3530")
                          }
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <button
                onClick={() => loadAwards(false)}
                disabled={loading}
                style={{
                  marginTop: 16,
                  background: "transparent",
                  border: "1px solid #1a1916",
                  borderRadius: 6,
                  padding: "8px 18px",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 12,
                  color: "#8a7d6e",
                  cursor: "pointer",
                }}
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>

      {/* Revoke modal */}
      {revoking && (
        <RevokeModal
          award={revoking}
          onConfirm={handleRevoke}
          onCancel={() => setRevoking(null)}
          loading={revokingId === revoking.id}
        />
      )}
    </div>
  );
}
