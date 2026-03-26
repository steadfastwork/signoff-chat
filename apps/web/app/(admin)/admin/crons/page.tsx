"use client";

import { useEffect, useState } from "react";

interface CronLog {
  id: string;
  jobName: string;
  ranAt: string;
  success: boolean;
  message: string | null;
  durationMs: number | null;
  triggeredBy: string | null;
}

interface JobEntry {
  name: string;
  lastRun: CronLog | null;
}

export default function AdminCronsPage() {
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { success: boolean; message: string | null; durationMs: number }>>({});

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/crons");
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const trigger = async (jobName: string) => {
    if (triggering) return;
    setTriggering(jobName);
    try {
      const res = await fetch("/api/admin/crons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobName }),
      });
      const data = await res.json();
      setResults((p) => ({
        ...p,
        [jobName]: { success: data.success ?? false, message: data.message ?? null, durationMs: data.durationMs ?? 0 },
      }));
      fetchJobs();
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <p style={{ color: "#8a7d6e", fontSize: 13, marginBottom: 24 }}>
        Manually trigger cron jobs. Results are logged to the audit trail.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ color: "#6b6456", fontFamily: "IBM Plex Mono, monospace", fontSize: 13 }}>Loading…</div>
        ) : jobs.map((job) => {
          const result = results[job.name];
          return (
            <div
              key={job.name}
              style={{
                background: "#111110",
                border: "1px solid #2a2620",
                borderRadius: 8,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: "#e8ddd0", fontSize: 13, fontFamily: "IBM Plex Mono, monospace", marginBottom: 4 }}>
                  {job.name}
                </div>
                {job.lastRun ? (
                  <div style={{ color: "#6b6456", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}>
                    Last run: {new Date(job.lastRun.ranAt).toLocaleString()}
                    {" · "}
                    <span style={{ color: job.lastRun.success ? "#2dd4bf" : "#ef4444" }}>
                      {job.lastRun.success ? "success" : "failed"}
                    </span>
                    {job.lastRun.durationMs != null && ` · ${job.lastRun.durationMs}ms`}
                  </div>
                ) : (
                  <div style={{ color: "#6b6456", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}>
                    Never run
                  </div>
                )}
                {result && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      fontFamily: "IBM Plex Mono, monospace",
                      color: result.success ? "#2dd4bf" : "#ef4444",
                    }}
                  >
                    {result.success ? "✓" : "✗"} {result.durationMs}ms
                    {result.message && ` — ${result.message.slice(0, 80)}`}
                  </div>
                )}
              </div>
              <button
                onClick={() => trigger(job.name)}
                disabled={triggering === job.name}
                style={{
                  padding: "8px 16px",
                  background: "rgba(200,134,10,0.1)",
                  border: "1px solid rgba(200,134,10,0.3)",
                  borderRadius: 6,
                  color: "#c8860a",
                  fontSize: 12,
                  fontFamily: "IBM Plex Mono, monospace",
                  cursor: triggering === job.name ? "not-allowed" : "pointer",
                  opacity: triggering === job.name ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {triggering === job.name ? "Running…" : "Trigger now"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
