"use client";

import React, { useState } from "react";
import { Filter, Search } from "lucide-react";

interface AuditClientProps {
  events: any[];
}

export function AuditClient({ events }: AuditClientProps) {
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [search, setSearch] = useState("");

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident operational ledger recording cold-chain mutations, alert acknowledgments &amp; rescue assignments
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
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
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 pl-8 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No audit records found matching query.
                  </td>
                </tr>
              ) : (
                filtered.map((ev) => {
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
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                          {ev.action}
                        </span>
                      </td>

                      <td className="px-6 py-3.5 text-slate-700 font-medium truncate max-w-xs">
                        {ev.actorEmail || "SYSTEM / DEVICE"}
                      </td>

                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-800">{ev.entityType}</span>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                          {ev.entityId}
                        </div>
                      </td>

                      <td className="px-6 py-3.5 max-w-md">
                        {parsedDetails ? (
                          <pre className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto font-mono">
                            {JSON.stringify(parsedDetails, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
