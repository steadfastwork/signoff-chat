"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface AdminRecord {
  id: string;
  screenname: string;
  adminRole: string;
  createdAt: string;
  lastActive: string | null;
  grantedAt: string | null;
  grantedBy: string;
}

export default function AdminManagementPage() {
  const { data: session } = useSession();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Grant form
  const [screenname, setScreenname] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [reason, setReason] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  const fetchAdmins = () => {
    setLoading(true);
    fetch("/api/admin/admins")
      .then((r) => r.json())
      .then(setAdmins)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const revoke = async (userId: string) => {
    if (revoking) return;
    setRevoking(userId);
    await fetch(`/api/admin/admins?userId=${userId}`, { method: "DELETE" });
    setRevoking(null);
    fetchAdmins();
  };

  const grant = async () => {
    if (granting || !screenname.trim() || !reason.trim()) return;
    setGranting(true);
    setGrantError(null);
    setGrantSuccess(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenname: screenname.trim(), role, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGrantError(data.error ?? "Something went wrong.");
        return;
      }
      setGrantSuccess(`@${screenname.trim()} now has ${role === "SUPER_ADMIN" ? "Super Admin" : "admin"} access.`);
      setScreenname("");
      setReason("");
      setRole("ADMIN");
      fetchAdmins();
    } finally {
      setGranting(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: "#e8ddd0", fontSize: 20, fontFamily: "IBM Plex Mono, monospace", margin: "0 0 6px" }}>
          Admin access
        </h1>
        <p style={{ color: "#8a7d6e", fontSize: 13, margin: 0 }}>
          Manage who has admin access to this control room. Be careful — admin access grants full moderation powers.
        </p>
      </div>

      {/* Current admins table */}
      <div
        style={{
          background: "#111110",
          border: "1px solid #2a2620",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 40,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2a2620" }}>
              {["User", "Role", "Granted", "Granted by", "Last active", "Actions"].map((h) => (
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
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>
                  Loading…
                </td>
              </tr>
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b6456" }}>
                  No admins found.
                </td>
              </tr>
            ) : (
              admins.map((a, i) => {
                const isSelf = a.id === session?.user?.id;
                const isSuper = a.adminRole === "SUPER_ADMIN";
                return (
                  <tr
                    key={a.id}
                    style={{ borderBottom: i < admins.length - 1 ? "1px solid #1a1916" : "none" }}
                  >
                    <td style={{ padding: "10px 16px", color: "#e8ddd0", fontSize: 13, fontFamily: "IBM Plex Mono, monospace" }}>
                      @{a.screenname}
                      {isSelf && (
                        <span style={{ color: "#6b6456", fontSize: 11, marginLeft: 6 }}>(you)</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {isSuper ? (
                        <span
                          style={{
                            background: "rgba(200,134,10,0.12)",
                            color: "#c8860a",
                            border: "1px solid rgba(200,134,10,0.3)",
                            borderRadius: 4,
                            padding: "2px 6px",
                            fontSize: 10,
                            fontFamily: "IBM Plex Mono, monospace",
                          }}
                        >
                          SUPER ADMIN
                        </span>
                      ) : (
                        <span
                          style={{
                            color: "#8a7d6e",
                            border: "1px solid #2a2620",
                            borderRadius: 4,
                            padding: "2px 6px",
                            fontSize: 10,
                            fontFamily: "IBM Plex Mono, monospace",
                          }}
                        >
                          ADMIN
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                      {a.grantedAt ? new Date(a.grantedAt).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                      {a.grantedBy === "database" ? (
                        <span style={{ color: "#6b6456" }}>database</span>
                      ) : (
                        `@${a.grantedBy}`
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", color: "#8a7d6e", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                      {a.lastActive ? new Date(a.lastActive).toLocaleString() : "Never"}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {!isSelf && !isSuper && (
                        <button
                          onClick={() => revoke(a.id)}
                          disabled={revoking === a.id}
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
                          {revoking === a.id ? "…" : "Revoke"}
                        </button>
                      )}
                      {(isSelf || isSuper) && (
                        <span style={{ color: "#6b6456", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Grant admin form */}
      <div
        style={{
          background: "#111110",
          border: "1px solid #2a2620",
          borderRadius: 8,
          padding: 24,
        }}
      >
        <h2
          style={{
            color: "#e8ddd0",
            fontSize: 14,
            fontFamily: "IBM Plex Mono, monospace",
            margin: "0 0 20px",
          }}
        >
          Grant admin access
        </h2>

        {grantError && (
          <div
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 6,
              padding: "10px 12px",
              marginBottom: 16,
              color: "#ef4444",
              fontSize: 12,
              fontFamily: "IBM Plex Mono, monospace",
            }}
          >
            {grantError}
          </div>
        )}

        {grantSuccess && (
          <div
            style={{
              background: "rgba(45,212,191,0.08)",
              border: "1px solid rgba(45,212,191,0.2)",
              borderRadius: 6,
              padding: "10px 12px",
              marginBottom: 16,
              color: "#2dd4bf",
              fontSize: 12,
              fontFamily: "IBM Plex Mono, monospace",
            }}
          >
            {grantSuccess}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#6b6456", fontFamily: "IBM Plex Mono, monospace", marginBottom: 6 }}>
              SCREENNAME
            </label>
            <input
              type="text"
              value={screenname}
              onChange={(e) => setScreenname(e.target.value)}
              placeholder="screenname"
              style={{
                width: "100%",
                background: "#0a0a09",
                border: "1px solid #2a2620",
                borderRadius: 6,
                padding: "8px 10px",
                color: "#e8ddd0",
                fontSize: 13,
                fontFamily: "IBM Plex Mono, monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#6b6456", fontFamily: "IBM Plex Mono, monospace", marginBottom: 6 }}>
              ROLE
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "SUPER_ADMIN")}
              style={{
                width: "100%",
                background: "#0a0a09",
                border: "1px solid #2a2620",
                borderRadius: 6,
                padding: "8px 10px",
                color: "#e8ddd0",
                fontSize: 13,
                fontFamily: "IBM Plex Mono, monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
        </div>

        {role === "SUPER_ADMIN" && (
          <div
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 6,
              padding: "10px 12px",
              marginBottom: 16,
              color: "#f87171",
              fontSize: 12,
              fontFamily: "IBM Plex Mono, monospace",
            }}
          >
            Warning: Super Admin has full access including admin management. This cannot be revoked via the UI.
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, color: "#6b6456", fontFamily: "IBM Plex Mono, monospace", marginBottom: 6 }}>
            REASON
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why is this person being granted admin access?"
            style={{
              width: "100%",
              background: "#0a0a09",
              border: "1px solid #2a2620",
              borderRadius: 6,
              padding: "8px 10px",
              color: "#e8ddd0",
              fontSize: 13,
              fontFamily: "IBM Plex Mono, monospace",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={grant}
          disabled={granting || !screenname.trim() || !reason.trim()}
          style={{
            padding: "8px 20px",
            background: "rgba(200,134,10,0.12)",
            border: "1px solid rgba(200,134,10,0.4)",
            borderRadius: 6,
            color: "#c8860a",
            fontSize: 13,
            fontFamily: "IBM Plex Mono, monospace",
            cursor: granting || !screenname.trim() || !reason.trim() ? "not-allowed" : "pointer",
            opacity: granting || !screenname.trim() || !reason.trim() ? 0.5 : 1,
          }}
        >
          {granting ? "Granting…" : "Grant access"}
        </button>
      </div>
    </div>
  );
}
