"use client";

import { useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  createdAt: string;
  adminId: string;
  adminScreenname: string;
  adminRole: string;
  action: string;
  targetId: string | null;
  targetType: string | null;
  note: string | null;
}

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchLogs = async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (cursor) params.set("cursor", cursor);
    try {
      const res = await fetch(`/api/admin/audit?${params}`);
      const data = await res.json();
      if (cursor) setLogs((p) => [...p, ...(data.logs ?? [])]);
      else setLogs(data.logs ?? []);
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const isAdminAction = (action: string) =>
    action.includes("admin") || action.includes("grant") || action.includes("revoke") || action.includes("promote");

  return (
    <div style={{ padding: 32 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action…"
          style={{
            background: "#111110",
            border: "1px solid #2a2620",
            borderRadius: 6,
            padding: "7px 10px",
            color: "#e8ddd0",
            fontSize: 12,
            fontFamily: "IBM Plex Mono, monospace",
            width: 200,
            outline: "none",
          }}
        />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          style={{
            background: "#111110",
            border: "1px solid #2a2620",
            borderRadius: 6,
            padding: "7px 10px",
            color: "#e8ddd0",
            fontSize: 12,
            fontFamily: "IBM Plex Mono, monospace",
            outline: "none",
            colorScheme: "dark",
          }}
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          style={{
            background: "#111110",
            border: "1px solid #2a2620",
            borderRadius: 6,
            padding: "7px 10px",
            color: "#e8ddd0",
            fontSize: 12,
            fontFamily: "IBM Plex Mono, monospace",
            outline: "none",
            colorScheme: "dark",
          }}
        />
        <button
          onClick={() => fetchLogs()}
          style={{
            padding: "7px 16px",
            background: "#1a1916",
            border: "1px solid #2a2620",
            borderRadius: 6,
            color: "#e8ddd0",
            fontSize: 12,
            fontFamily: "IBM Plex Mono, monospace",
            cursor: "pointer",
          }}
        >
          Apply
        </button>
      </div>

      {/* Log table */}
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
              {["When", "Admin", "Role", "Action", "Target", "Note"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontFamily: "IBM Plex Mono, monospace", color: "#6b6456", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>No audit log entries.</td></tr>
            ) : logs.map((entry, i) => (
              <tr
                key={entry.id}
                style={{
                  borderBottom: i < logs.length - 1 ? "1px solid #1a1916" : "none",
                  borderLeft: isAdminAction(entry.action) ? "3px solid #c8860a" : "3px solid transparent",
                }}
              >
                <td style={{ padding: "10px 16px", color: "#6b6456", fontSize: 11, fontFamily: "IBM Plex Mono, monospace", whiteSpace: "nowrap" }}>
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  @{entry.adminScreenname}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{
                    color: entry.adminRole === "SUPER_ADMIN" ? "#c8860a" : "#6b6456",
                    fontSize: 10,
                    fontFamily: "IBM Plex Mono, monospace",
                  }}>
                    {entry.adminRole === "SUPER_ADMIN" ? "SUPER" : "ADMIN"}
                  </span>
                </td>
                <td style={{ padding: "10px 16px", color: "#e8ddd0", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {entry.action}
                </td>
                <td style={{ padding: "10px 16px", color: "#6b6456", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}>
                  {entry.targetType && entry.targetId
                    ? `${entry.targetType}:${entry.targetId.slice(0, 8)}…`
                    : "—"}
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.note ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button
            onClick={() => fetchLogs(nextCursor)}
            style={{ padding: "8px 20px", background: "#1a1916", border: "1px solid #2a2620", borderRadius: 6, color: "#e8ddd0", fontSize: 13, cursor: "pointer", fontFamily: "IBM Plex Mono, monospace" }}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
