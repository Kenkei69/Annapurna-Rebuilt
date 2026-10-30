"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastBanner, ToastMessage } from "@/components/ui/ToastBanner";
import { PlusCircle, Truck, X, Search, Filter } from "lucide-react";

export interface VehicleRecord {
  id: string;
  organizationId: string;
  licensePlate: string;
  makeModel: string;
  reeferType: string;
  tempCapabilityMin: number;
  tempCapabilityMax: number;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  createdAt: string | Date;
  updatedAt: string | Date;
  shipments?: Array<{
    id: string;
    trackingNumber: string;
    title: string;
    status: string;
  }>;
}

interface FleetClientProps {
  vehicles: VehicleRecord[];
}

export function FleetClient({ vehicles }: FleetClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [licensePlate, setLicensePlate] = useState("");
  const [makeModel, setMakeModel] = useState("Tata Prima Reefer 2830");
  const [reeferType, setReeferType] = useState("Carrier Transicold Supra 850");
  const [tempMin, setTempMin] = useState(-25.0);
  const [tempMax, setTempMax] = useState(15.0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tempMin >= tempMax) {
      setToast({
        type: "error",
        message: "Minimum temperature capability must be less than maximum capability.",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/fleet/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licensePlate: licensePlate.trim().toUpperCase(),
          makeModel: makeModel.trim(),
          reeferType: reeferType.trim(),
          tempCapabilityMin: Number(tempMin),
          tempCapabilityMax: Number(tempMax),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register reefer vehicle");
      }

      setShowModal(false);
      setLicensePlate("");
      setToast({
        type: "success",
        message: `Reefer vehicle ${data.vehicle?.licensePlate || "unit"} registered successfully.`,
      });
      router.refresh();
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to register reefer vehicle",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        v.licensePlate.toLowerCase().includes(q) ||
        v.makeModel.toLowerCase().includes(q) ||
        v.reeferType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reefer Fleet Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered refrigerated vehicles, cooling unit capabilities &amp; operational dispatch readiness
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <PlusCircle size={16} />
          <span>Register Reefer Unit</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by license plate, vehicle model, or cooling system..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Statuses ({vehicles.length})</option>
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">License Plate</th>
                <th className="px-6 py-3">Vehicle Model</th>
                <th className="px-6 py-3">Cooling Unit &amp; Capabilities</th>
                <th className="px-6 py-3">Active Shipment</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    {vehicles.length === 0
                      ? "No reefer units registered for this fleet."
                      : "No vehicles match the active search/filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  const activeShipment = v.shipments?.[0];

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Truck size={14} className="text-slate-400" />
                          <span>{v.licensePlate}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {v.makeModel}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{v.reeferType}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Range: {v.tempCapabilityMin}°C to {v.tempCapabilityMax}°C
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {activeShipment ? (
                          <span className="font-bold text-emerald-700">
                            {activeShipment.trackingNumber} ({activeShipment.title})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Available (Ready for Dispatch)</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={v.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-2">Register Reefer Unit</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a refrigerated vehicle to your fleet registry with calibrated temperature bounds.
            </p>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  License Plate
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH-12-RN-9081"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900 uppercase focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Make &amp; Vehicle Model
                </label>
                <input
                  type="text"
                  required
                  value={makeModel}
                  onChange={(e) => setMakeModel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Cooling Unit Specification
                </label>
                <input
                  type="text"
                  required
                  value={reeferType}
                  onChange={(e) => setReeferType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Min Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={tempMin}
                    onChange={(e) => setTempMin(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Max Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={tempMax}
                    onChange={(e) => setTempMax(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-medium hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                >
                  {loading ? "Registering..." : "Register Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
