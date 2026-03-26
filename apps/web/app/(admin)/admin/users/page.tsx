"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UserDetailPanel from "@/components/admin/UserDetailPanel";

interface AdminUser {
  id: string;
  screenname: string;
  isGoldMember: boolean;
  adminRole: string | null;
  status: string;
  isSuspended: boolean;
  suspendedUntil: string | null;
  warningCount: number;
  createdAt: string;
  _count: { posts: number; reports: number };
}

const TABS = [
  { key: "all", label: "All" },
  { key: "suspended", label: "Suspended" },
  { key: "gold", label: "Gold" },
  { key: "new", label: "New this week" },
];

function StatusPill({ user }: { user: AdminUser }) {
  if (user.isSuspended) {
    return (
      <span
        style={{
          background: "rgba(239,68,68,0.15)",
          color: "#ef4444",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: 11,
          fontFamily: "IBM Plex Mono, monospace",
        }}
      >
        SUSPENDED
      </span>
    );
  }
  if (user.status === "ONLINE" || user.status === "AWAY" || user.status === "IDLE") {
    return (
      <span
        style={{
          background: "rgba(45,212,191,0.1)",
          color: "#2dd4bf",
          border: "1px solid rgba(45,212,191,0.25)",
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: 11,
          fontFamily: "IBM Plex Mono, monospace",
        }}
      >
        {user.status}
      </span>
    );
  }
  return (
    <span style={{ color: "#6b6456", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}>
      {user.status}
    </span>
  );
}

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") ?? "all";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const fetchUsers = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      const params = new URLSearchParams({ tab });
      if (search) params.set("search", search);
      if (cursor) params.set("cursor", cursor);
      try {
        const res = await fetch(`/api/admin/users?${params}`);
        const data = await res.json();
        if (cursor) {
          setUsers((prev) => [...prev, ...data.users]);
        } else {
          setUsers(data.users ?? []);
        }
        setNextCursor(data.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [tab, search]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openPanel = (user: AdminUser) => {
    setSelectedUser(user);
    setPanelOpen(true);
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #2a2620", paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              const p = new URLSearchParams(searchParams.toString());
              if (t.key === "all") p.delete("tab");
              else p.set("tab", t.key);
              router.push(`/admin/users?${p.toString()}`);
            }}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid #c8860a" : "2px solid transparent",
              color: tab === t.key ? "#c8860a" : "#8a7d6e",
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

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by screenname…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
          style={{
            background: "#111110",
            border: "1px solid #2a2620",
            borderRadius: 6,
            padding: "8px 12px",
            color: "#e8ddd0",
            fontSize: 13,
            fontFamily: "IBM Plex Mono, monospace",
            width: 280,
            outline: "none",
          }}
        />
      </div>

      {/* Table */}
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
              {["User", "Status", "Role", "Joined", "Posts", "Warnings", "Actions"].map((h) => (
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
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user, i) => (
                <tr
                  key={user.id}
                  onClick={() => openPanel(user)}
                  style={{
                    borderBottom: i < users.length - 1 ? "1px solid #1a1916" : "none",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#1a1916")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                >
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "#e8ddd0", fontSize: 13, fontFamily: "IBM Plex Mono, monospace" }}>
                        @{user.screenname}
                      </span>
                      {user.isGoldMember && (
                        <span style={{ color: "#c8860a", fontSize: 10 }}>★</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusPill user={user} />
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    {user.adminRole ? (
                      <span
                        style={{
                          background: "rgba(200,134,10,0.1)",
                          color: "#c8860a",
                          border: "1px solid rgba(200,134,10,0.3)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontSize: 10,
                          fontFamily: "IBM Plex Mono, monospace",
                        }}
                      >
                        {user.adminRole === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}
                      </span>
                    ) : (
                      <span style={{ color: "#6b6456", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                    {user._count.posts}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    {user.warningCount > 0 ? (
                      <span
                        style={{
                          background: "rgba(245,158,11,0.15)",
                          color: "#f59e0b",
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontSize: 11,
                          fontFamily: "IBM Plex Mono, monospace",
                        }}
                      >
                        {user.warningCount}
                      </span>
                    ) : (
                      <span style={{ color: "#6b6456", fontSize: 12 }}>0</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openPanel(user)}
                        style={{
                          padding: "4px 10px",
                          background: "none",
                          border: "1px solid #2a2620",
                          borderRadius: 4,
                          color: "#8a7d6e",
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "IBM Plex Mono, monospace",
                        }}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {nextCursor && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button
            onClick={() => fetchUsers(nextCursor)}
            disabled={loading}
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
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {/* Detail panel */}
      {panelOpen && selectedUser && (
        <UserDetailPanel
          userId={selectedUser.id}
          onClose={() => setPanelOpen(false)}
          onAction={() => {
            setPanelOpen(false);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}
