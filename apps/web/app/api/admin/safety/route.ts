/**
 * Admin Safety API
 *
 * GET  /api/admin/safety          — list incidents (filterable by status/type)
 * PATCH /api/admin/safety/[id]    — update status, add notes, or trigger NCMEC report
 *
 * All endpoints require isAdmin=true on the session user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fileNCMECReport } from "@/lib/safety/ncmec";
import { internalError } from "@/lib/api-error";

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) return null;
  return session.user.id;
}

// ---------------------------------------------------------------------------
// GET /api/admin/safety
// Query params: status, incidentType, page (default 1), limit (default 50)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const status       = searchParams.get("status") ?? undefined;
    const incidentType = searchParams.get("incidentType") ?? undefined;
    const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit        = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

    const where: Record<string, unknown> = {};
    if (status)       where.status       = status;
    if (incidentType) where.incidentType = incidentType;

    const [incidents, total] = await Promise.all([
      prisma.safetyIncident.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:  (page - 1) * limit,
        take:  limit,
        select: {
          id:               true,
          createdAt:        true,
          incidentType:     true,
          status:           true,
          reporterId:       true,
          uploaderId:       true,
          uploaderName:     true,
          contentUrl:       true,
          contentType:      true,
          matchProvider:    true,
          matchConfidence:  true,
          actionsTaken:     true,
          ncmecReportId:    true,
          ncmecReportedAt:  true,
          preservedPath:    true,
          preservedAt:      true,
          resolvedAt:       true,
          resolvedBy:       true,
          internalNotes:    true,
          // Exclude uploaderEmailHash and fileKey from list view — available via direct lookup if needed
        },
      }),
      prisma.safetyIncident.count({ where }),
    ]);

    return NextResponse.json({
      incidents,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return internalError(err, "GET /api/admin/safety");
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/safety
// Body: { id, action: "confirm" | "dismiss" | "resolve" | "file_ncmec", notes? }
// ---------------------------------------------------------------------------

const VALID_ACTIONS = ["confirm", "dismiss", "resolve", "file_ncmec"] as const;
type AdminAction = typeof VALID_ACTIONS[number];

export async function PATCH(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { id, action, notes } = body as Record<string, string>;

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(action as AdminAction)) {
    return NextResponse.json({ error: `action must be one of: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
  }

  try {
    const incident = await prisma.safetyIncident.findUnique({ where: { id } });
    if (!incident) return NextResponse.json({ error: "not found" }, { status: 404 });

    switch (action as AdminAction) {

      case "confirm": {
        await prisma.safetyIncident.update({
          where: { id },
          data: {
            status:        "CONFIRMED" as any,
            internalNotes: notes ? `[${new Date().toISOString()}] ${adminId}: ${notes}` : incident.internalNotes,
          },
        });
        break;
      }

      case "dismiss": {
        await prisma.safetyIncident.update({
          where: { id },
          data: {
            status:      "FALSE_POSITIVE" as any,
            resolvedAt:  new Date(),
            resolvedBy:  adminId,
            internalNotes: notes
              ? `[${new Date().toISOString()}] Dismissed by ${adminId}: ${notes}`
              : `[${new Date().toISOString()}] Dismissed by ${adminId}`,
          },
        });
        break;
      }

      case "resolve": {
        await prisma.safetyIncident.update({
          where: { id },
          data: {
            status:      "RESOLVED" as any,
            resolvedAt:  new Date(),
            resolvedBy:  adminId,
            internalNotes: notes
              ? `[${new Date().toISOString()}] Resolved by ${adminId}: ${notes}`
              : incident.internalNotes,
          },
        });
        break;
      }

      case "file_ncmec": {
        // Manually trigger NCMEC filing for a USER_REPORT incident that staff confirmed
        if (!["CSAM", "CSAM_SUSPECTED", "USER_REPORT"].includes(incident.incidentType)) {
          return NextResponse.json(
            { error: "NCMEC reports can only be filed for CSAM/CSAM_SUSPECTED/USER_REPORT incidents" },
            { status: 422 }
          );
        }
        if (incident.ncmecReportId) {
          return NextResponse.json({ error: "NCMEC report already filed", ncmecReportId: incident.ncmecReportId }, { status: 409 });
        }

        // Update notes before filing
        if (notes) {
          await prisma.safetyIncident.update({
            where: { id },
            data: {
              internalNotes: `[${new Date().toISOString()}] Filing NCMEC by ${adminId}: ${notes}`,
            },
          });
        }

        // Fire-and-forget — result written back to incident by fileNCMECReport
        fileNCMECReport({
          incidentId:        incident.id,
          uploaderId:        incident.uploaderId,
          uploaderName:      incident.uploaderName,
          uploaderEmailHash: incident.uploaderEmailHash,
          fileUrl:           incident.contentUrl,
          mimeType:          incident.contentType,
          incidentType:      (incident.incidentType === "CSAM" ? "CSAM" : "CSAM_SUSPECTED") as "CSAM" | "CSAM_SUSPECTED",
          provider:          incident.matchProvider ?? "manual",
          confidence:        incident.matchConfidence ?? 1.0,
          detectedAt:        incident.scannedAt ?? incident.createdAt,
        }).catch((err) => {
          console.error("[admin/safety] NCMEC filing error:", err);
        });

        return NextResponse.json({ ok: true, message: "NCMEC report queued" });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err, "PATCH /api/admin/safety");
  }
}
