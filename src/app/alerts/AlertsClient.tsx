"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Check,
  X,
} from "lucide-react";

interface AlertsClientProps {
  alerts: any[];
  userRole: string;
}

export function AlertsClient({ alerts, userRole }: AlertsClientProps) {
  const router = useRouter();
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const [actingAlertId, setActingAlertId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"ack" | "resolve" | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = alerts.filter((a) => {
    if (filterSeverity !== "ALL" && a.severity !== filterSeverity) return false;
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    return true;
  });

  const handleAction = async (alertId: string) => {
    if (!actionType) return;
    if (actionType === "resolve" && !notes.trim()) {
      alert("Resolution notes are required to document audit outcome.");
      return;
    }

    try {
      setSubmitting(true);
      const url = `/api/alerts/${alertId}/${actionType === "ack" ? "acknowledge" : "resolve"}`;
      const payload = actionType === "ack" ? { notes } : { resolutionNotes: notes };

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
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cold-Chain Alert Center</h1>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic thermal threshold breaches, sustained compressor failures &amp; operational resolutions
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Incidents</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Severity / Rule</th>
                <th className="px-6 py-3">Shipment Reference</th>
                <th className="px-6 py-3">Incident Summary &amp; Recommendations</th>
                <th className="px-6 py-3">Status / Ownership</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No alerts match the selected criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((alert) => {
                  const triggerData = alert.triggerReadingJson
                    ? JSON.parse(alert.triggerReadingJson)
                    : null;

                  return (
                    <tr key={alert.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1.5">
                          <StatusBadge status={alert.severity} />
                          <div className="font-mono font-bold text-slate-800 text-[11px]">
                            {alert.ruleCode}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(alert.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <Link
                          href={`/shipments/${alert.shipmentId}`}
                          className="font-bold text-slate-900 hover:text-emerald-600 font-mono"
                        >
                          {alert.shipment?.trackingNumber || "Shipment"}
                        </Link>
                        <div className="text-slate-600 text-[11px] mt-0.5">
                          {alert.shipment?.title}
                        </div>
                        <div className="text-slate-400 text-[10px]">
                          {alert.shipment?.cargoType} (Safe: {alert.shipment?.tempMin}° - {alert.shipment?.tempMax}°C)
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top max-w-md">
                        <p className="font-semibold text-slate-800 leading-normal">{alert.summary}</p>
                        {triggerData && (
                          <div className="mt-1 font-mono text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                            Trigger Reading: {triggerData.temperature}°C (Limit: {triggerData.limit}°C)
                          </div>
                        )}
                        {alert.recommendedAction && (
                          <p className="text-[11px] text-slate-500 mt-1.5">
                            <span className="font-semibold text-slate-700">Recommended Action:</span>{" "}
                            {alert.recommendedAction}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1">
                          <StatusBadge status={alert.status} />
                          {alert.acknowledgedBy && (
                            <div className="text-[10px] text-slate-500">
                              Ack by: <span className="font-medium text-slate-700">{alert.acknowledgedBy.name}</span>
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
                            className="px-2.5 py-1.5 bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 rounded text-xs font-semibold"
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
                            className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded text-xs font-semibold"
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
      </div>

      {/* Action Dialog Modal */}
      {actingAlertId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              {actionType === "ack" ? "Acknowledge Thermal Alert" : "Document Incident Resolution"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {actionType === "ack"
                ? "Record operational acknowledgment in the tamper-evident audit history."
                : "Confirm corrective actions taken to stabilize temperature and prevent cargo degradation."}
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Audit Notes {actionType === "resolve" ? "(Required)" : "(Optional)"}
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  actionType === "ack"
                    ? "e.g. Driver notified; checking reefer power harness."
                    : "e.g. Compressor restarted; temperature returned to 3.2°C; goods verified intact."
                }
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActingAlertId(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction(actingAlertId)}
                disabled={submitting}
                className={`px-4 py-1.5 text-white rounded text-xs font-semibold ${
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
