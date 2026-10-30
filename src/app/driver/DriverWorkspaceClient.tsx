"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Truck,
  Thermometer,
  MapPin,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Package,
  LifeBuoy,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastBanner, ToastMessage } from "@/components/ui/ToastBanner";

interface Shipment {
  id: string;
  trackingNumber: string;
  title: string;
  cargoType: string;
  tempMin: number;
  tempMax: number;
  status: string;
  originName: string;
  destName: string;
  latestTemperature: number | null;
  latestRecordedAt: string | null;
  updatedAt: string;
  alerts: { id: string; severity: string; status: string; summary: string }[];
  assignedVehicle: { licensePlate: string; makeModel: string } | null;
  rescueOpportunity: {
    id: string;
    status: string;
    title: string;
    urgency: string;
    milestones: { id: string; milestoneType: string; notes: string | null; recordedAt: string }[];
  } | null;
}

interface DriverWorkspaceClientProps {
  shipments: Shipment[];
  driverId: string;
}

function formatAge(dateStr: string | null): string {
  if (!dateStr) return "No readings";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getTempStatus(temp: number | null, min: number, max: number): "ok" | "warning" | "critical" {
  if (temp === null) return "warning";
  if (temp > max + 2 || temp < min - 2) return "critical";
  if (temp > max || temp < min) return "warning";
  return "ok";
}

export function DriverWorkspaceClient({ shipments, driverId: _driverId }: DriverWorkspaceClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [markingDelivered, setMarkingDelivered] = useState<string | null>(null);

  const activeShipments = shipments.filter(
    (s) => !["DELIVERED", "CANCELLED", "RESCUED"].includes(s.status)
  );
  const completedShipments = shipments.filter(
    (s) => ["DELIVERED", "CANCELLED", "RESCUED"].includes(s.status)
  );

  const handleMarkDelivered = async (shipmentId: string, trackingNumber: string) => {
    if (!confirm(`Mark ${trackingNumber} as DELIVERED? This cannot be undone.`)) return;

    try {
      setMarkingDelivered(shipmentId);
      const res = await fetch(`/api/shipments/${shipmentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "DELIVERED", notes: "Marked delivered by driver" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      setToast({ type: "success", message: `Shipment ${trackingNumber} marked as delivered.` });
      router.refresh();
    } catch (err: unknown) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setMarkingDelivered(null);
    }
  };

  return (
    <div className="space-y-6">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Driver Workspace</h1>
        <p className="text-sm text-slate-500 mt-1">Your assigned cargo routes and active alerts</p>
      </div>

      {/* Active shipments */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
          Active Routes ({activeShipments.length})
        </h2>

        {activeShipments.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <Truck size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">No active assignments</p>
            <p className="text-xs text-slate-400 mt-1">
              Contact your dispatcher to receive a cargo assignment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeShipments.map((shipment) => {
              const tempStatus = getTempStatus(shipment.latestTemperature, shipment.tempMin, shipment.tempMax);
              const hasAlerts = shipment.alerts.length > 0;
              const isRescuePending = shipment.rescueOpportunity?.status === "OPEN" || shipment.rescueOpportunity?.status === "OFFERED";

              return (
                <div
                  key={shipment.id}
                  className={`bg-white border rounded-xl overflow-hidden shadow-xs transition-all ${
                    hasAlerts ? "border-amber-200" : "border-slate-200"
                  }`}
                >
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-slate-500">{shipment.trackingNumber}</span>
                          <StatusBadge status={shipment.status} />
                          {hasAlerts && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              <AlertTriangle size={11} />
                              {shipment.alerts.length} Alert{shipment.alerts.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          {isRescuePending && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                              <LifeBuoy size={11} />
                              Rescue Active
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-slate-900">{shipment.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{shipment.cargoType}</p>
                      </div>

                      {/* Temperature reading */}
                      <div className={`text-right shrink-0 ${
                        tempStatus === "critical" ? "text-red-600" :
                        tempStatus === "warning" ? "text-amber-600" : "text-emerald-600"
                      }`}>
                        <div className="flex items-center gap-1 justify-end">
                          <Thermometer size={14} />
                          <span className="font-bold text-lg">
                            {shipment.latestTemperature !== null ? `${shipment.latestTemperature.toFixed(1)}°C` : "—"}
                          </span>
                        </div>
                        <div className="text-xs opacity-70">
                          {shipment.tempMin}°C – {shipment.tempMax}°C band
                        </div>
                        <div className="text-xs opacity-60 flex items-center gap-1 justify-end mt-0.5">
                          <Clock size={10} />
                          {formatAge(shipment.latestRecordedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} />
                        <span className="truncate max-w-[120px]">{shipment.originName}</span>
                        <ChevronRight size={12} />
                        <span className="truncate max-w-[120px]">{shipment.destName}</span>
                      </div>
                      {shipment.assignedVehicle && (
                        <div className="flex items-center gap-1">
                          <Truck size={12} />
                          <span>{shipment.assignedVehicle.licensePlate}</span>
                        </div>
                      )}
                    </div>

                    {/* Alerts section */}
                    {hasAlerts && (
                      <div className="mt-3 space-y-1.5">
                        {shipment.alerts.slice(0, 3).map((alert) => (
                          <div key={alert.id} className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-100 rounded px-2.5 py-1.5">
                            <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                            <span className="text-amber-800">{alert.summary}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rescue milestones */}
                    {(shipment.rescueOpportunity?.milestones ?? []).length > 0 && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <p className="text-xs font-medium text-slate-500 mb-1.5">Rescue Progress</p>
                        <div className="space-y-1">
                          {(shipment.rescueOpportunity?.milestones ?? []).map((m) => (
                            <div key={m.id} className="flex items-center gap-2 text-xs text-slate-600">
                              <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                              <span>{m.milestoneType.replace(/_/g, " ")}</span>
                              <span className="text-slate-400">{new Date(m.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href={`/shipments/${shipment.id}`}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      Full Details <ChevronRight size={12} />
                    </Link>

                    {shipment.status === "IN_TRANSIT" && (
                      <button
                        onClick={() => handleMarkDelivered(shipment.id, shipment.trackingNumber)}
                        disabled={markingDelivered === shipment.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors"
                      >
                        <CheckCircle2 size={13} />
                        {markingDelivered === shipment.id ? "Updating…" : "Mark Delivered"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Completed shipments */}
      {completedShipments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
            Recent Completed ({completedShipments.length})
          </h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500">Shipment</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">Route</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">Status</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">Completed</th>
                </tr>
              </thead>
              <tbody>
                {completedShipments.slice(0, 10).map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <Link href={`/shipments/${s.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                        {s.trackingNumber}
                      </Link>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Package size={10} />
                        {s.cargoType}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {s.originName} → {s.destName}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
