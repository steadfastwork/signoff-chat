"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  total: number;
  newThisWeek: number;
  gold: number;
  online: number;
  openReports: number;
  suspended: number;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: "#1a1916",
        border: `1px solid ${accent ? "rgba(200,134,10,0.4)" : "#2a2620"}`,
        borderRadius: 8,
        padding: "20px 24px",
        flex: 1,
        minWidth: 160,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: "IBM Plex Mono, monospace",
          color: "#8a7d6e",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontFamily: "IBM Plex Mono, monospace",
          color: accent ? "#c8860a" : "#e8ddd0",
          fontWeight: 700,
          lineHeight: 1,
          marginBottom: sub ? 6 : 0,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: "#6b6456", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const onlinePercent =
    stats && stats.total > 0
      ? ((stats.online / stats.total) * 100).toFixed(1)
      : "0";

  return (
    <div style={{ padding: 32 }}>
      {/* Stat cards */}
      {loading ? (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 40,
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: "#1a1916",
                border: "1px solid #2a2620",
                borderRadius: 8,
                padding: "20px 24px",
                flex: 1,
                minWidth: 160,
                height: 96,
              }}
            />
          ))}
        </div>
      ) : stats ? (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 40,
          }}
        >
          <StatCard
            label="Total users"
            value={stats.total.toLocaleString()}
            sub={`+${stats.newThisWeek} this week`}
          />
          <StatCard
            label="Gold members"
            value={stats.gold.toLocaleString()}
            sub={`${stats.total > 0 ? ((stats.gold / stats.total) * 100).toFixed(1) : 0}% of users`}
          />
          <StatCard
            label="Online now"
            value={stats.online.toLocaleString()}
            sub={`${onlinePercent}% of users`}
          />
          <StatCard
            label="Open reports"
            value={stats.openReports.toLocaleString()}
            accent={stats.openReports > 0}
          />
          <StatCard
            label="Suspended"
            value={stats.suspended.toLocaleString()}
          />
        </div>
      ) : null}

      {/* Quick links */}
      <div style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 12,
            color: "#6b6456",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Quick actions
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { href: "/admin/reports", label: "Review reports" },
            { href: "/admin/users?tab=suspended", label: "Suspended users" },
            { href: "/admin/safety", label: "Safety incidents" },
            { href: "/admin/crons", label: "Cron jobs" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                padding: "8px 16px",
                background: "#111110",
                border: "1px solid #2a2620",
                borderRadius: 6,
                color: "#e8ddd0",
                fontSize: 13,
                textDecoration: "none",
                fontFamily: "IBM Plex Mono, monospace",
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity placeholder */}
      <div>
        <h2
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 12,
            color: "#6b6456",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Recent activity
        </h2>
        <div
          style={{
            background: "#1a1916",
            border: "1px solid #2a2620",
            borderRadius: 8,
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#6b6456", fontSize: 13, fontFamily: "IBM Plex Mono, monospace", margin: 0 }}>
            Full activity log available at{" "}
            <Link href="/admin/activity" style={{ color: "#c8860a" }}>
              /admin/activity
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
