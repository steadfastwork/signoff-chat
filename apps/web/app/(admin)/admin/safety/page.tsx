"use client";

/**
 * Staff Safety Dashboard — /safety (admin-only)
 *
 * Lists SafetyIncident records with filter controls.
 * Staff can confirm, dismiss (false positive), or manually trigger NCMEC filing.
 */

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Incident {
  id:              string;
  createdAt:       string;
  incidentType:    string;
  status:          string;
  reporterId:      string | null;
  uploaderId:      string | null;
  uploaderName:    string;
  contentUrl:      string;
  contentType:     string;
  matchProvider:   string | null;
  matchConfidence: number | null;
  actionsTaken:    string | null;
  ncmecReportId:   string | null;
  ncmecReportedAt: string | null;
  preservedPath:   string | null;
  preservedAt:     string | null;
  resolvedAt:      string | null;
  resolvedBy:      string | null;
  internalNotes:   string | null;
}

interface PaginatedResponse {
  incidents:  Incident[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

// ---------------------------------------------------------------------------
// Status badge colours
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  DETECTED:          "bg-red-100 text-red-800",
  CONFIRMED:         "bg-orange-100 text-orange-800",
  REPORTED_TO_NCMEC: "bg-blue-100 text-blue-800",
  CONTENT_REMOVED:   "bg-yellow-100 text-yellow-800",
  ACCOUNT_SUSPENDED: "bg-purple-100 text-purple-800",
  RESOLVED:          "bg-green-100 text-green-800",
  FALSE_POSITIVE:    "bg-gray-100 text-gray-600",
};

const TYPE_COLORS: Record<string, string> = {
  CSAM:             "bg-red-600 text-white",
  CSAM_SUSPECTED:   "bg-red-100 text-red-800",
  ILLEGAL_CONTENT:  "bg-orange-100 text-orange-800",
  THREAT:           "bg-yellow-100 text-yellow-800",
  USER_REPORT:      "bg-blue-100 text-blue-800",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SafetyDashboard() {
  const [incidents, setIncidents]   = useState<Incident[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter]   = useState("");
  const [typeFilter, setTypeFilter]       = useState("");

  // Action modal
  const [actionTarget, setActionTarget]   = useState<Incident | null>(null);
  const [actionType, setActionType]       = useState<string>("");
  const [actionNotes, setActionNotes]     = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]     = useState<string | null>(null);

  const fetchIncidents = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter)   params.set("incidentType", typeFilter);

      const res  = await fetch(`/api/admin/safety?${params}`);
      const data = (await res.json()) as PaginatedResponse;
      if (!res.ok) throw new Error((data as any).error ?? "Unknown error");
      setIncidents(data.incidents);
      setPagination({ page, total: data.pagination.total, pages: data.pagination.pages });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { fetchIncidents(1); }, [fetchIncidents]);

  async function performAction() {
    if (!actionTarget || !actionType) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/safety", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: actionTarget.id, action: actionType, notes: actionNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setActionTarget(null);
      setActionType("");
      setActionNotes("");
      await fetchIncidents(pagination.page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Safety Incidents</h1>

        {/* Filters */}
        <div className="mb-4 flex gap-3 flex-wrap">
          <select
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {["DETECTED","CONFIRMED","REPORTED_TO_NCMEC","CONTENT_REMOVED","ACCOUNT_SUSPENDED","RESOLVED","FALSE_POSITIVE"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {["CSAM","CSAM_SUSPECTED","ILLEGAL_CONTENT","THREAT","USER_REPORT"].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={() => fetchIncidents(1)}
            className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            Refresh
          </button>
          <span className="ml-auto self-center text-sm text-gray-500">
            {pagination.total} total incidents
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Incidents table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Created","Type","Status","Uploader","Content","Provider","Confidence","NCMEC","Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-gray-400">Loading…</td></tr>
              ) : incidents.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-gray-400">No incidents found</td></tr>
              ) : incidents.map(inc => (
                <tr key={inc.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                    {new Date(inc.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <Badge label={inc.incidentType} colorClass={TYPE_COLORS[inc.incidentType] ?? "bg-gray-100 text-gray-700"} />
                  </td>
                  <td className="px-3 py-3">
                    <Badge label={inc.status} colorClass={STATUS_COLORS[inc.status] ?? "bg-gray-100 text-gray-700"} />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    <span className="font-medium">{inc.uploaderName}</span>
                    {inc.uploaderId && <span className="block text-gray-400">{inc.uploaderId.slice(0, 8)}…</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 max-w-xs truncate">
                    <span title={inc.contentUrl}>{inc.contentUrl}</span>
                    <span className="block text-gray-400">{inc.contentType}</span>
                  </td>
                  <td className="px-3 py-3 text-xs">{inc.matchProvider ?? "—"}</td>
                  <td className="px-3 py-3 text-xs">
                    {inc.matchConfidence != null ? `${(inc.matchConfidence * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {inc.ncmecReportId ? (
                      <span className="text-green-700 font-medium">{inc.ncmecReportId}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {inc.status === "DETECTED" && (
                        <>
                          <button
                            onClick={() => { setActionTarget(inc); setActionType("confirm"); }}
                            className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-800 hover:bg-orange-200"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => { setActionTarget(inc); setActionType("dismiss"); }}
                            className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                      {["DETECTED","CONFIRMED"].includes(inc.status) && !inc.ncmecReportId && (
                        <button
                          onClick={() => { setActionTarget(inc); setActionType("file_ncmec"); }}
                          className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 hover:bg-blue-200"
                        >
                          File NCMEC
                        </button>
                      )}
                      {inc.status !== "RESOLVED" && inc.status !== "FALSE_POSITIVE" && (
                        <button
                          onClick={() => { setActionTarget(inc); setActionType("resolve"); }}
                          className="rounded bg-green-100 px-2 py-1 text-xs text-green-800 hover:bg-green-200"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                    {inc.internalNotes && (
                      <p className="mt-1 text-xs text-gray-400 truncate max-w-xs" title={inc.internalNotes}>
                        {inc.internalNotes}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-4 flex gap-2 justify-center">
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => fetchIncidents(p)}
                className={`rounded px-3 py-1.5 text-sm ${p === pagination.page ? "bg-gray-800 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action modal */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-gray-900">
              {actionType === "confirm"    && "Confirm incident"}
              {actionType === "dismiss"    && "Dismiss as false positive"}
              {actionType === "resolve"    && "Mark as resolved"}
              {actionType === "file_ncmec" && "File NCMEC CyberTipline report"}
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Incident <span className="font-mono">{actionTarget.id}</span> — {actionTarget.uploaderName}
            </p>

            {actionType === "file_ncmec" && (
              <div className="mb-4 rounded bg-orange-50 p-3 text-sm text-orange-800">
                This will submit a report to the NCMEC CyberTipline. Only do this for
                confirmed CSAM content. Ensure evidence is preserved before filing.
              </div>
            )}

            <textarea
              className="mb-4 w-full rounded border border-gray-300 p-2 text-sm"
              rows={3}
              placeholder="Internal notes (optional)"
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
            />

            {actionError && (
              <p className="mb-3 text-sm text-red-600">{actionError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setActionTarget(null); setActionType(""); setActionNotes(""); setActionError(null); }}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={performAction}
                className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
                disabled={actionLoading}
              >
                {actionLoading ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
