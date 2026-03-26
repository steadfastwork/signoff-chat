"use client";

import { useEffect, useState } from "react";

interface Channel {
  id: string;
  name: string;
  type: string;
  description: string | null;
  createdAt: string;
  isFeatured: boolean;
  isVerified: boolean;
  creator: { id: string; screenname: string };
  _count: { members: number };
}

export default function AdminChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [patching, setPatching] = useState<string | null>(null);

  const fetchChannels = async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    try {
      const res = await fetch(`/api/admin/channels?${params}`);
      const data = await res.json();
      if (cursor) setChannels((p) => [...p, ...(data.channels ?? [])]);
      else setChannels(data.channels ?? []);
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChannels(); }, []);

  const deleteChannel = async (id: string) => {
    if (deleting) return;
    if (!confirm("Delete this channel? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`/api/admin/channels?channelId=${id}`, { method: "DELETE" });
    setDeleting(null);
    setChannels((p) => p.filter((c) => c.id !== id));
  };

  const patchChannel = async (id: string, field: "isFeatured" | "isVerified", value: boolean) => {
    if (patching) return;
    setPatching(id);
    try {
      const res = await fetch("/api/admin/channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: id, [field]: value }),
      });
      if (res.ok) {
        setChannels((p) =>
          p.map((c) => c.id === id ? { ...c, [field]: value } : c)
        );
      }
    } finally {
      setPatching(null);
    }
  };

  const btnBase: React.CSSProperties = {
    padding: "3px 8px",
    borderRadius: 4,
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "IBM Plex Mono, monospace",
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
              {["Name", "Type", "Members", "Creator", "Featured", "Verified", "Actions"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontFamily: "IBM Plex Mono, monospace", color: "#6b6456", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && channels.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>Loading…</td></tr>
            ) : channels.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>No channels.</td></tr>
            ) : channels.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: i < channels.length - 1 ? "1px solid #1a1916" : "none" }}>
                <td style={{ padding: "10px 16px", color: "#e8ddd0", fontSize: 13, fontFamily: "IBM Plex Mono, monospace" }}>
                  #{c.name}
                  {c.description && (
                    <div style={{ fontSize: 11, color: "#6b6456", marginTop: 2, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.description}
                    </div>
                  )}
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {c.type}
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {c._count.members}
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  @{c.creator.screenname}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <button
                    onClick={() => patchChannel(c.id, "isFeatured", !c.isFeatured)}
                    disabled={patching === c.id}
                    style={{
                      ...btnBase,
                      background: c.isFeatured ? "rgba(200,134,10,0.15)" : "rgba(200,134,10,0.04)",
                      border: `1px solid ${c.isFeatured ? "rgba(200,134,10,0.4)" : "rgba(200,134,10,0.15)"}`,
                      color: c.isFeatured ? "#c8860a" : "#6b6456",
                      opacity: patching === c.id ? 0.5 : 1,
                    }}
                  >
                    {c.isFeatured ? "★ featured" : "☆ feature"}
                  </button>
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <button
                    onClick={() => patchChannel(c.id, "isVerified", !c.isVerified)}
                    disabled={patching === c.id}
                    style={{
                      ...btnBase,
                      background: c.isVerified ? "rgba(45,212,191,0.1)" : "rgba(45,212,191,0.03)",
                      border: `1px solid ${c.isVerified ? "rgba(45,212,191,0.35)" : "rgba(45,212,191,0.12)"}`,
                      color: c.isVerified ? "#2dd4bf" : "#6b6456",
                      opacity: patching === c.id ? 0.5 : 1,
                    }}
                  >
                    {c.isVerified ? "✓ verified" : "✓ verify"}
                  </button>
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <button
                    onClick={() => deleteChannel(c.id)}
                    disabled={deleting === c.id}
                    style={{
                      ...btnBase,
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      color: "#ef4444",
                    }}
                  >
                    {deleting === c.id ? "…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextCursor && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button onClick={() => fetchChannels(nextCursor)} style={{ padding: "8px 20px", background: "#1a1916", border: "1px solid #2a2620", borderRadius: 6, color: "#e8ddd0", fontSize: 13, cursor: "pointer", fontFamily: "IBM Plex Mono, monospace" }}>
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
