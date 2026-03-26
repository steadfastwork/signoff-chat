"use client";

import { useEffect, useState } from "react";

interface Board {
  id: string;
  name: string;
  displayName: string;
  type: string;
  memberCount: number;
  createdAt: string;
  creator: { id: string; screenname: string };
  _count: { members: number };
}

export default function AdminBoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchBoards = async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    try {
      const res = await fetch(`/api/admin/boards?${params}`);
      const data = await res.json();
      if (cursor) setBoards((p) => [...p, ...(data.boards ?? [])]);
      else setBoards(data.boards ?? []);
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBoards(); }, []);

  const deleteBoard = async (id: string) => {
    if (deleting) return;
    if (!confirm("Delete this board? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`/api/admin/boards?boardId=${id}`, { method: "DELETE" });
    setDeleting(null);
    setBoards((p) => p.filter((b) => b.id !== id));
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
              {["Name", "Display name", "Type", "Members", "Creator", "Created", "Actions"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontFamily: "IBM Plex Mono, monospace", color: "#6b6456", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && boards.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>Loading…</td></tr>
            ) : boards.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>No boards.</td></tr>
            ) : boards.map((b, i) => (
              <tr key={b.id} style={{ borderBottom: i < boards.length - 1 ? "1px solid #1a1916" : "none" }}>
                <td style={{ padding: "10px 16px", color: "#e8ddd0", fontSize: 13, fontFamily: "IBM Plex Mono, monospace" }}>
                  b/{b.name}
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12 }}>
                  {b.displayName}
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {b.type}
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {b.memberCount}
                </td>
                <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  @{b.creator.screenname}
                </td>
                <td style={{ padding: "10px 16px", color: "#6b6456", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {new Date(b.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <button
                    onClick={() => deleteBoard(b.id)}
                    disabled={deleting === b.id}
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
                    {deleting === b.id ? "…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextCursor && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button onClick={() => fetchBoards(nextCursor)} style={{ padding: "8px 20px", background: "#1a1916", border: "1px solid #2a2620", borderRadius: 6, color: "#e8ddd0", fontSize: 13, cursor: "pointer", fontFamily: "IBM Plex Mono, monospace" }}>
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
