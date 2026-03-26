"use client";

import { useEffect, useState } from "react";

interface Invite {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  usesRemaining: number;
  isRevoked: boolean;
  channel: { id: string; name: string } | null;
  board: { id: string; name: string } | null;
}

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchInvites = async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    try {
      const res = await fetch(`/api/admin/invites?${params}`);
      const data = await res.json();
      if (cursor) setInvites((p) => [...p, ...(data.invites ?? [])]);
      else setInvites(data.invites ?? []);
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvites(); }, []);

  const revoke = async (id: string) => {
    if (revoking) return;
    setRevoking(id);
    await fetch(`/api/admin/invites?inviteId=${id}`, { method: "DELETE" });
    setRevoking(null);
    setInvites((p) => p.filter((inv) => inv.id !== id));
  };

  return (
    <div style={{ padding: 32 }}>
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
              {["Token", "Target", "Uses left", "Expires", "Created", "Actions"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontFamily: "IBM Plex Mono, monospace", color: "#6b6456", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && invites.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>Loading…</td></tr>
            ) : invites.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>No active invite links.</td></tr>
            ) : invites.map((inv, i) => (
              <tr key={inv.id} style={{ borderBottom: i < invites.length - 1 ? "1px solid #1a1916" : "none" }}>
                <td style={{ padding: "10px 16px", color: "#e8ddd0", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {inv.token.slice(0, 12)}…
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {inv.channel ? `#${inv.channel.name}` : inv.board ? `b/${inv.board.name}` : "—"}
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {inv.usesRemaining}
                </td>
                <td style={{ padding: "10px 16px", color: "#6b6456", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "10px 16px", color: "#6b6456", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {new Date(inv.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <button
                    onClick={() => revoke(inv.id)}
                    disabled={revoking === inv.id}
                    style={{
                      padding: "4px 10px",
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      borderRadius: 4,
                      color: "#ef4444",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  >
                    {revoking === inv.id ? "…" : "Revoke"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextCursor && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button onClick={() => fetchInvites(nextCursor)} style={{ padding: "8px 20px", background: "#1a1916", border: "1px solid #2a2620", borderRadius: 6, color: "#e8ddd0", fontSize: 13, cursor: "pointer", fontFamily: "IBM Plex Mono, monospace" }}>
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
