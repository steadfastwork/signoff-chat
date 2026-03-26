import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin, notFound, auditLog } from "@/lib/admin-auth";

const KNOWN_JOBS = [
  { name: "rotate-channel-keys", path: "/api/cron/rotate-channel-keys" },
  { name: "cleanup-channel-messages", path: "/api/cron/cleanup-channel-messages" },
  { name: "purge-messages", path: "/api/cron/purge-messages" },
  { name: "cleanup-invite-links", path: "/api/cron/cleanup-invite-links" },
  { name: "archive-board-posts", path: "/api/cron/archive-board-posts" },
  { name: "retry-ncmec-reports", path: "/api/cron/retry-ncmec-reports" },
  { name: "check-unreported-incidents", path: "/api/cron/check-unreported-incidents" },
  { name: "rotate-rate-limit-salt", path: "/api/cron/rotate-rate-limit-salt" },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  // Get last run for each known job
  const lastRuns = await prisma.cronLog.findMany({
    where: { jobName: { in: KNOWN_JOBS.map((j) => j.name) } },
    orderBy: { ranAt: "desc" },
    distinct: ["jobName"],
  });

  type CronLogEntry = { id: string; jobName: string; ranAt: Date; success: boolean; message: string | null; durationMs: number | null; triggeredBy: string | null };
  const lastRunMap = Object.fromEntries((lastRuns as CronLogEntry[]).map((r) => [r.jobName, r]));

  return NextResponse.json({
    jobs: KNOWN_JOBS.map((job) => ({
      name: job.name,
      lastRun: lastRunMap[job.name] ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }
  if (!session?.user) return notFound();

  let body: { jobName: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const job = KNOWN_JOBS.find((j) => j.name === body.jobName);
  if (!job) {
    return NextResponse.json({ error: "unknown job" }, { status: 400 });
  }

  const start = Date.now();

  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}${job.path}`, {
      method: "POST",
      headers: {
        "x-cron-secret": process.env.CRON_SECRET ?? "",
        "Content-Type": "application/json",
      },
    });

    const durationMs = Date.now() - start;
    const success = res.ok;
    let message: string | null = null;
    try {
      const data = await res.json();
      message = JSON.stringify(data);
    } catch {}

    await prisma.cronLog.create({
      data: {
        jobName: job.name,
        success,
        message,
        durationMs,
        triggeredBy: session.user.id,
      },
    });

    await auditLog({
      adminId: session.user.id,
      adminRole: session.user.adminRole as "ADMIN" | "SUPER_ADMIN",
      action: `trigger-cron:${job.name}`,
      note: `Manually triggered. Success: ${success}. Duration: ${durationMs}ms`,
    });

    return NextResponse.json({ ok: true, success, durationMs, message });
  } catch (err) {
    const durationMs = Date.now() - start;
    await prisma.cronLog.create({
      data: {
        jobName: job.name,
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
        durationMs,
        triggeredBy: session.user.id,
      },
    });
    return NextResponse.json({ ok: false, error: "trigger failed" }, { status: 500 });
  }
}
