import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlusCircle, ArrowRight, PlayCircle } from "lucide-react";
import { AlertStatus } from "@prisma/client";

export default async function ShipmentsListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = user.memberships[0]?.organizationId;

  const shipments = await prisma.shipment.findMany({
    where: user.role === "ADMIN" ? {} : { organizationId: orgId },
    include: {
      assignedVehicle: true,
      assignedDevice: true,
      alerts: {
        where: { status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] } },
      },
      rescueOpportunity: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const vehicles = await prisma.vehicle.findMany({
    where: user.role === "ADMIN" ? {} : { organizationId: orgId },
  });

  const devices = await prisma.device.findMany({
    where: user.role === "ADMIN" ? {} : { organizationId: orgId },
  });

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.memberships[0]?.organization,
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Shipment Registry</h1>
            <p className="text-xs text-slate-500 mt-1">
              Active perishable shipments, assigned reefer telemetry, and threshold boundaries
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold border border-slate-300"
            >
              <PlayCircle size={15} className="text-emerald-700" />
              <span>Launch Simulator</span>
            </Link>
          </div>
        </div>

        {/* Create Shipment Form in Expandable Details or Card */}
        <details className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs group">
          <summary className="px-6 py-4 flex items-center justify-between cursor-pointer list-none hover:bg-slate-50/70 select-none">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <PlusCircle size={18} className="text-emerald-600" />
              <span>Create New Cold-Chain Shipment</span>
            </div>
            <span className="text-xs font-semibold text-emerald-700 group-open:hidden">
              + Open Form
            </span>
            <span className="text-xs font-semibold text-slate-500 hidden group-open:inline">
              Close
            </span>
          </summary>

          <form action="/api/shipments" method="POST" className="p-6 border-t border-slate-200 bg-slate-50/50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Shipment Title
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Export Alphonso Mangoes"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Cargo Category
                </label>
                <select
                  name="cargoType"
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                >
                  <option value="Fresh Produce">Fresh Produce (1°C - 4°C)</option>
                  <option value="Dairy Products">Dairy Products (2°C - 5.5°C)</option>
                  <option value="Pharmaceuticals">Pharmaceuticals &amp; Vaccines (2°C - 6°C)</option>
                  <option value="Frozen Meats">Frozen Meats (-22°C - -18°C)</option>
                  <option value="Seafood">Chilled Seafood (-1°C - 2°C)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tracking Code (Optional)
                </label>
                <input
                  type="text"
                  name="trackingNumber"
                  placeholder="Leave empty for auto-generated"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Temp Min (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="tempMin"
                  required
                  defaultValue="2.0"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Temp Max (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="tempMax"
                  required
                  defaultValue="6.0"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Origin Location
                </label>
                <input
                  type="text"
                  name="originName"
                  required
                  placeholder="e.g. Pune Central Depot"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Destination Location
                </label>
                <input
                  type="text"
                  name="destName"
                  required
                  placeholder="e.g. Mumbai Port Terminal"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Assign Reefer Vehicle
                </label>
                <select
                  name="assignedVehicleId"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                >
                  <option value="">Unassigned</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.licensePlate} ({v.makeModel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Assign IoT Edge Device
                </label>
                <select
                  name="assignedDeviceId"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                >
                  <option value="">Unassigned</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.deviceIdentifier} ({d.hardwareModel})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-xs"
              >
                Provision &amp; Dispatch Shipment
              </button>
            </div>
          </form>
        </details>

        {/* Shipments Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Tracking &amp; Cargo</th>
                  <th className="px-6 py-3">Route</th>
                  <th className="px-6 py-3">Boundaries</th>
                  <th className="px-6 py-3 text-right">Latest Temp</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      No shipments registered. Use the form above to dispatch a shipment.
                    </td>
                  </tr>
                ) : (
                  shipments.map((s) => {
                    const isBreach =
                      s.latestTemperature != null &&
                      (s.latestTemperature > s.tempMax || s.latestTemperature < s.tempMin);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <Link
                            href={`/shipments/${s.id}`}
                            className="font-bold text-slate-900 hover:text-emerald-600 font-mono"
                          >
                            {s.trackingNumber}
                          </Link>
                          <div className="text-slate-600 font-medium text-xs mt-0.5">{s.title}</div>
                          <div className="text-slate-400 text-[11px]">{s.cargoType}</div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-slate-800 font-medium">{s.destName}</div>
                          <div className="text-slate-400 text-[10px]">From: {s.originName}</div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-mono text-slate-700">
                            {s.tempMin}°C to {s.tempMax}°C
                          </div>
                          {s.humidityMax != null && (
                            <div className="text-[10px] text-slate-400">
                              Max Hum: {s.humidityMax}%
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          {s.latestTemperature != null ? (
                            <div>
                              <span
                                className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded ${
                                  isBreach
                                    ? "bg-red-100 text-red-800 border border-red-200"
                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                }`}
                              >
                                {s.latestTemperature.toFixed(1)}°C
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {s.latestRecordedAt ? new Date(s.latestRecordedAt).toLocaleTimeString() : ""}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No telemetry</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <StatusBadge status={s.status} />
                          {s.alerts.length > 0 && (
                            <div className="text-[10px] text-red-600 font-semibold mt-1">
                              {s.alerts.length} active alert{s.alerts.length > 1 ? "s" : ""}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/shipments/${s.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium text-xs transition-colors"
                          >
                            <span>Inspect</span>
                            <ArrowRight size={13} />
                          </Link>
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
    </AppShell>
  );
}
