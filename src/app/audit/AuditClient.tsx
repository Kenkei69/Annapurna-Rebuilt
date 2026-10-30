"use client";

import React, { useState } from "react";
import { Filter, Search } from "lucide-react";

export interface AuditRecord {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  detailsJson: string | null;
  ipAddress: string | null;
  createdAt: string | Date;
}

interface AuditClientProps {
  events: AuditRecord[];
}

export function AuditClient({ events }: AuditClientProps) {
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = events.filter((ev) => {
    if (filterAction !== "ALL" && ev.action !== filterAction) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchActor = ev.actorEmail?.toLowerCase().includes(q);
      const matchAction = ev.action.toLowerCase().includes(q);
      const matchEntity = ev.entityType.toLowerCase().includes(q) || ev.entityId.toLowerCase().includes(q);
      if (!matchActor && !matchAction && !matchEntity) return false;
    }
    return true;
  });

  const actions = Array.from(new Set(events.map((e) => e.action)));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedEvents = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">
            Append-only operational audit ledger recording cold-chain mutations, alert acknowledgments &amp; rescue assignments
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="ALL">All Actions ({events.length})</option>
              {actions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search audit trail..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 pl-8 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 shadow-xs"
            />
            <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Actor</th>
                <th className="px-6 py-3">Entity Target</th>
                <th className="px-6 py-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No audit records found matching query.
                  </td>
                </tr>
              ) : (
                paginatedEvents.map((ev) => {
                  let parsedDetails = null;
                  try {
                    parsedDetails = ev.detailsJson ? JSON.parse(ev.detailsJson) : null;
                  } catch {
                    parsedDetails = ev.detailsJson;
                  }

                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleString()}
                      </td>

                      <td className="px-6 py-3.5">
                        <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[10px]">
                          {ev.action}
                        </span>
                      </td>

                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-800">{ev.actorEmail || "SYSTEM"}</div>
                        {ev.actorId && <div className="text-[10px] text-slate-400 font-mono">{ev.actorId}</div>}
                      </td>

                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-700">{ev.entityType}</span>
                        <div className="text-[10px] text-slate-400 font-mono">{ev.entityId}</div>
                      </td>

                      <td className="px-6 py-3.5">
                        {parsedDetails ? (
                          <pre className="text-[10px] font-mono bg-slate-50 p-2 rounded border border-slate-100 max-w-sm overflow-x-auto text-slate-700">
                            {JSON.stringify(parsedDetails, null, 1)}
                          </pre>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 font-medium">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
