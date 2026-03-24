import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// Staff-only report management.
// Checks isAdmin on the User record — not just the session token.
// ---------------------------------------------------------------------------

async function requireAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  return user?.isAdmin === true;
}

// ---------------------------------------------------------------------------
// GET /api/admin/reports — list pending reports with context
// ?status=PENDING|REVIEWED|ACTIONED|DISMISSED (default: PENDING)
// ?reason=CSAM|SPAM|... (optional filter)
// ?limit=50&cursor=<id>
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await requireAdmin(session.user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";
  const reason = searchParams.get("reason") ?? undefined;
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  const reports = await prisma.report.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where: {
      status: status as "PENDING" | "REVIEWED" | "ACTIONED" | "DISMISSED",
      ...(reason ? { reason: reason as "SPAM" | "HARASSMENT" | "CSAM" | "THREAT" | "IMPERSONATION" | "OTHER" } : {}),
    },
    orderBy: [
      // CSAM always surfaces first within status bucket
      { reason: "desc" },
      { createdAt: "asc" },
    ],
    include: {
      reporter: { select: { id: true, screenname: true, warningCount: true } },
    },
  });

  const hasMore = reports.length > limit;
  const items   = hasMore ? reports.slice(0, limit) : reports;
  const next    = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ reports: items, nextCursor: next });
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/reports/[reportId]
// Body: {
//   action: "warn" | "suspend" | "dismiss",
//   suspendDays?: number,   // omit for permanent; action=suspend only
//   internalNote?: string,
// }
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await requireAdmin(session.user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Extract reportId from the URL
  const { pathname } = new URL(req.url);
  const reportId = pathname.split("/").pop();
  if (!reportId) {
    return NextResponse.json({ error: "reportId is required in the URL." }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid json." }, { status: 400 });
  }

  const { action, suspendDays, internalNote } = body as {
    action:        "warn" | "suspend" | "dismiss";
    suspendDays?:  number;
    internalNote?: string;
  };

  if (!["warn", "suspend", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "invalid action." }, { status: 400 });
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { reporter: { select: { id: true, screenname: true } } },
  });
  if (!report) {
    return NextResponse.json({ error: "report not found." }, { status: 404 });
  }

  const targetUserId = report.targetUserId;

  // ── warn ──────────────────────────────────────────────────────────────────
  if (action === "warn") {
    if (targetUserId) {
      const user = await prisma.user.update({
        where: { id: targetUserId },
        data: { warningCount: { increment: 1 } },
        select: { screenname: true, warningCount: true },
      });

      // Email the warned user via Resend
      try {
        // We only have emailHash — we can't email them directly.
        // Instead, log it and trust the user will see it on next login.
        // (Future: in-app notification system)
        console.info(
          `[admin] Warning issued to @${user.screenname} (warning #${user.warningCount}). Report: ${reportId}`
        );
      } catch {}
    }

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status:     "ACTIONED",
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
        resolution: `warn${internalNote ? ` — ${internalNote}` : ""}`,
      },
    });
  }

  // ── suspend ───────────────────────────────────────────────────────────────
  if (action === "suspend") {
    if (!targetUserId) {
      return NextResponse.json({ error: "report has no target user to suspend." }, { status: 400 });
    }

    const now = new Date();
    const suspendedUntil = suspendDays
      ? new Date(now.getTime() + suspendDays * 86400_000)
      : null; // null = permanent

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isSuspended:    true,
        suspendedAt:    now,
        suspendedUntil: suspendedUntil,
        suspendReason:  internalNote ?? "Violation of community guidelines.",
      },
    });

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status:     "ACTIONED",
        resolvedAt: now,
        resolvedBy: session.user.id,
        resolution: `suspend:${suspendDays ?? "permanent"}${internalNote ? ` — ${internalNote}` : ""}`,
      },
    });
  }

  // ── dismiss ───────────────────────────────────────────────────────────────
  if (action === "dismiss") {
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status:     "DISMISSED",
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
        resolution: internalNote ?? "no action required.",
      },
    });
  }

  return NextResponse.json({ ok: true, action, reportId });
}
