"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Report {
  id: string;
  createdAt: string;
  reason: string;
  status: string;
  targetUserId: string | null;
  targetPostId: string | null;
  targetMsgId: string | null;
  detail: string | null;
  reporter: { id: string; screenname: string; warningCount: number };
}

const TABS = [
  { key: "PENDING", label: "Pending" },
  { key: "REVIEWED", label: "Reviewed" },
  { key: "ACTIONED", label: "Actioned" },
  { key: "DISMISSED", label: "Dismissed" },
];

const REASON_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  CSAM: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", border: "rgba(239,68,68,0.35)" },
  THREAT: { bg: "rgba(249,115,22,0.12)", color: "#f97316", border: "rgba(249,115,22,0.3)" },
  SPAM: { bg: "rgba(200,134,10,0.12)", color: "#c8860a", border: "rgba(200,134,10,0.3)" },
  HARASSMENT: { bg: "rgba(168,85,247,0.12)", color: "#a855f7", border: "rgba(168,85,247,0.3)" },
  IMPERSONATION: { bg: "rgba(99,102,241,0.12)", color: "#818cf8", border: "rgba(99,102,241,0.3)" },
  OTHER: { bg: "rgba(45,212,191,0.1)", color: "#2dd4bf", border: "rgba(45,212,191,0.25)" },
};

function ReasonPill({ reason }: { reason: string }) {
  const style = REASON_COLORS[reason] ?? REASON_COLORS.OTHER;
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        borderRadius: 4,
        padding: "2px 7px",
        fontSize: 10,
        fontFamily: "IBM Plex Mono, monospace",
        letterSpacing: "0.04em",
      }}
    >
      {reason}
    </span>
  );
}

export default function AdminReportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get("status") ?? "PENDING";

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const fetchReports = async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ status });
    if (cursor) params.set("cursor", cursor);
    try {
      const res = await fetch(`/api/admin/reports?${params}`);
      const data = await res.json();
      if (cursor) {
        setReports((prev) => [...prev, ...(data.reports ?? [])]);
      } else {
        setReports(data.reports ?? []);
      }
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [status]);

  const doAction = async (reportId: string, action: string, suspendDays?: number) => {
    if (acting) return;
    setActing(reportId);
    try {
      await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action === "suspend" ? "suspend" : action, suspendDays }),
      });
      fetchReports();
    } finally {
      setActing(null);
    }
  };

  // Sort CSAM to top
  const sorted = [...reports].sort((a, b) => {
    if (a.reason === "CSAM" && b.reason !== "CSAM") return -1;
    if (b.reason === "CSAM" && a.reason !== "CSAM") return 1;
    return 0;
  });

  const targetType = (r: Report) => {
    if (r.targetUserId) return "User";
    if (r.targetPostId) return "Post";
    if (r.targetMsgId) return "Message";
    return "—";
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #2a2620" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              const p = new URLSearchParams(searchParams.toString());
              p.set("status", t.key);
              router.push(`/admin/reports?${p.toString()}`);
            }}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "none",
              borderBottom: status === t.key ? "2px solid #c8860a" : "2px solid transparent",
              color: status === t.key ? "#c8860a" : "#8a7d6e",
              fontSize: 13,
              fontFamily: "IBM Plex Mono, monospace",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        style={{
          background: "#111110",
          border: "1px solid #2a2620",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2a2620" }}>
              {["Type", "Target", "Reporter", "Submitted", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 16px",
                    textAlign: "left",
                    fontSize: 11,
                    fontFamily: "IBM Plex Mono, monospace",
                    color: "#6b6456",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && reports.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>
                  Loading…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>
                  No {status.toLowerCase()} reports.
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: i < sorted.length - 1 ? "1px solid #1a1916" : "none",
                    background: r.reason === "CSAM" ? "rgba(239,68,68,0.03)" : "transparent",
                  }}
                >
                  <td style={{ padding: "10px 16px" }}>
                    <ReasonPill reason={r.reason} />
                  </td>
                  <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                    {targetType(r)}
                  </td>
                  <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                    @{r.reporter.screenname}
                  </td>
                  <td style={{ padding: "10px 16px", color: "#6b6456", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                    {r.status}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    {status === "PENDING" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => doAction(r.id, "dismiss")}
                          disabled={acting === r.id}
                          style={{
                            padding: "4px 8px",
                            background: "none",
                            border: "1px solid #2a2620",
                            borderRadius: 4,
                            color: "#8a7d6e",
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: "IBM Plex Mono, monospace",
                          }}
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => doAction(r.id, "warn")}
                          disabled={acting === r.id}
                          style={{
                            padding: "4px 8px",
                            background: "rgba(200,134,10,0.1)",
                            border: "1px solid rgba(200,134,10,0.3)",
                            borderRadius: 4,
                            color: "#c8860a",
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: "IBM Plex Mono, monospace",
                          }}
                        >
                          Warn
                        </button>
                        <button
                          onClick={() => doAction(r.id, "suspend", 7)}
                          disabled={acting === r.id}
                          style={{
                            padding: "4px 8px",
                            background: "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.25)",
                            borderRadius: 4,
                            color: "#ef4444",
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: "IBM Plex Mono, monospace",
                          }}
                        >
                          Suspend 7d
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button
            onClick={() => fetchReports(nextCursor)}
            style={{
              padding: "8px 20px",
              background: "#1a1916",
              border: "1px solid #2a2620",
              borderRadius: 6,
              color: "#e8ddd0",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "IBM Plex Mono, monospace",
            }}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
