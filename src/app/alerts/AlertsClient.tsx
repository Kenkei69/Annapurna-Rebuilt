"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastBanner, ToastMessage } from "@/components/ui/ToastBanner";
import { Filter, CheckCircle2, Clock, X, Search } from "lucide-react";

export interface AlertRecord {
  id: string;
  shipmentId: string;
  ruleCode: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  summary: string;
  createdAt: string | Date;
  acknowledgedAt?: string | Date | null;
  resolvedAt?: string | Date | null;
  ackNotes?: string | null;
  resolutionNotes?: string | null;
  acknowledgedBy?: { id: string; name: string } | null;
  resolvedBy?: { id: string; name: string } | null;
  shipment: {
    id: string;
    trackingNumber: string;
    title: string;
    cargoType: string;
    tempMin: number;
    tempMax: number;
    latestTemperature?: number | null;
  };
}

interface AlertsClientProps {
  alerts: AlertRecord[];
  userRole: string;
}

export function AlertsClient({ alerts, userRole: _userRole }: AlertsClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [actingAlertId, setActingAlertId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"ack" | "resolve" | null>(null);
  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && actingAlertId) {
        setActingAlertId(null);
        setActionType(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actingAlertId]);

  const filtered = alerts.filter((a) => {
    if (filterSeverity !== "ALL" && a.severity !== filterSeverity) return false;
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        a.shipment.trackingNumber.toLowerCase().includes(q) ||
        a.shipment.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.ruleCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedAlerts = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleAction = async (alertId: string) => {
    if (!actionType) return;
    if (actionType === "resolve" && !notes.trim()) {
      setToast({
        type: "error",
        message: "Resolution notes are required to document audit outcome.",
      });
      return;
    }

    try {
      setSubmitting(true);
      const url = `/api/alerts/${alertId}/${actionType === "ack" ? "acknowledge" : "resolve"}`;
      const payload =
        actionType === "ack"
          ? { notes }
          : {
              resolutionNotes: notes,
              ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
            };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Action failed");
      }

      setActingAlertId(null);
      setActionType(null);
      setNotes("");
      setOverrideReason("");
      setToast({
        type: "success",
        message: actionType === "ack" ? "Alert acknowledged." : "Alert resolved successfully.",
      });
      router.refresh();
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Action failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cold-Chain Alert Center</h1>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic thermal threshold breaches, sustained compressor failures &amp; operational resolutions
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filterSeverity}
              onChange={(e) => {
                setFilterSeverity(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="ALL">All Statuses ({alerts.length})</option>
              <option value="ACTIVE">Active Breaches</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
        <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by tracking number, cargo title, summary, or rule code..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-900"
        />
      </div>

      {/* Alerts Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Severity &amp; Rule</th>
                <th className="px-6 py-3">Affected Cargo &amp; Route</th>
                <th className="px-6 py-3">Incident Summary</th>
                <th className="px-6 py-3">Timeline &amp; Actor</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAlerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-80" />
                    <p className="font-medium text-slate-600">No active incidents matching criteria</p>
                    <p className="text-[11px] mt-0.5">All monitored cold-chain shipments within calibrated temperature envelopes.</p>
                  </td>
                </tr>
              ) : (
                paginatedAlerts.map((alert) => {
                  return (
                    <tr key={alert.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1.5">
                          <StatusBadge status={alert.severity} />
                          <span className="font-mono text-[10px] text-slate-400">{alert.ruleCode}</span>
                          <StatusBadge status={alert.status} />
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <Link
                          href={`/shipments/${alert.shipment.id}`}
                          className="font-bold text-slate-900 hover:text-emerald-700 font-mono transition-colors"
                        >
                          {alert.shipment.trackingNumber}
                        </Link>
                        <div className="font-medium text-slate-700 mt-0.5">{alert.shipment.title}</div>
                        <div className="text-[11px] text-slate-400">
                          Envelope: {alert.shipment.tempMin}°C to {alert.shipment.tempMax}°C
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-slate-800 leading-relaxed max-w-md">
                          {alert.summary}
                        </div>
                        {alert.ackNotes && (
                          <div className="mt-1.5 text-[11px] text-amber-800 bg-amber-50/80 p-2 rounded border border-amber-200/60">
                            <span className="font-semibold">Acknowledgment:</span> {alert.ackNotes}
                          </div>
                        )}
                        {alert.resolutionNotes && (
                          <div className="mt-1.5 text-[11px] text-emerald-800 bg-emerald-50/80 p-2 rounded border border-emerald-200/60">
                            <span className="font-semibold">Resolution:</span> {alert.resolutionNotes}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top text-slate-500">
                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center gap-1 text-slate-600">
                            <Clock size={11} />
                            <span>Raised: {new Date(alert.createdAt).toLocaleString()}</span>
                          </div>
                          {alert.acknowledgedBy && (
                            <div className="text-[10px] text-amber-700">
                              Ack by: <span className="font-medium">{alert.acknowledgedBy.name}</span>
                            </div>
                          )}
                          {alert.resolvedBy && (
                            <div className="text-[10px] text-emerald-700">
                              Resolved by: <span className="font-medium">{alert.resolvedBy.name}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top text-right">
                        {alert.status === "ACTIVE" && (
                          <button
                            onClick={() => {
                              setActingAlertId(alert.id);
                              setActionType("ack");
                              setNotes("");
                            }}
                            className="px-2.5 py-1.5 bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 rounded text-xs font-semibold transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}

                        {alert.status === "ACKNOWLEDGED" && (
                          <button
                            onClick={() => {
                              setActingAlertId(alert.id);
                              setActionType("resolve");
                              setNotes("");
                            }}
                            className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded text-xs font-semibold transition-colors"
                          >
                            Resolve
                          </button>
                        )}

                        {alert.status === "RESOLVED" && (
                          <span className="text-[11px] text-slate-400 italic">Closed</span>
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
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} incidents
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

      {/* Action Dialog Modal */}
      {actingAlertId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => {
                setActingAlertId(null);
                setActionType(null);
              }}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-2">
              {actionType === "ack" ? "Acknowledge Thermal Alert" : "Document Incident Resolution"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {actionType === "ack"
                ? "Record operational acknowledgment in the append-only audit history."
                : "Confirm corrective actions taken to stabilize temperature and prevent cargo degradation."}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Audit Notes {actionType === "resolve" ? "(Required)" : "(Optional)"}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    actionType === "ack"
                      ? "e.g. Driver notified; checking reefer power harness."
                      : "e.g. Compressor restarted; temperature returned to safe band; goods verified intact."
                  }
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {actionType === "resolve" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Override Reason (Optional note if manual override applied)
                  </label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Temperature sensor re-calibrated; verified by secondary probe."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActingAlertId(null);
                  setActionType(null);
                }}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction(actingAlertId)}
                disabled={submitting}
                className={`px-4 py-1.5 text-white rounded text-xs font-semibold transition-colors ${
                  actionType === "ack"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {submitting ? "Recording..." : actionType === "ack" ? "Acknowledge Alert" : "Confirm Resolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
