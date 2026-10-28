"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlusCircle } from "lucide-react";

interface FleetClientProps {
  vehicles: any[];
}

export function FleetClient({ vehicles }: FleetClientProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [licensePlate, setLicensePlate] = useState("");
  const [makeModel, setMakeModel] = useState("Tata Prima Reefer 2830");
  const [reeferType, setReeferType] = useState("Carrier Transicold Supra 850");
  const [tempMin, setTempMin] = useState(-25.0);
  const [tempMax, setTempMax] = useState(15.0);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch("/api/fleet/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licensePlate,
          makeModel,
          reeferType,
          tempCapabilityMin: tempMin,
          tempCapabilityMax: tempMax,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register reefer vehicle");
      }

      setShowModal(false);
      setLicensePlate("");
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reefer Fleet Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered refrigerated vehicles, cooling unit capabilities &amp; operational dispatch readiness
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <PlusCircle size={16} />
          <span>Register Reefer Unit</span>
        </button>
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
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No reefer units registered for this fleet.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => {
                  const activeShipment = v.shipments?.[0];

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        {v.licensePlate}
                      </td>

                      <td className="px-6 py-4 font-medium text-slate-800">
                        {v.makeModel}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-700">{v.reeferType}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Capability: {v.tempCapabilityMin}°C to {v.tempCapabilityMax}°C
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {activeShipment ? (
                          <span className="font-medium text-emerald-700">
                            {activeShipment.trackingNumber} ({activeShipment.title})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Available (Idle)</span>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Register Reefer Truck</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a refrigerated vehicle with verified temperature bounds for cargo assignment.
            </p>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  License Plate
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH-12-PQ-9988"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900 uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Make &amp; Chassis Model
                </label>
                <input
                  type="text"
                  required
                  value={makeModel}
                  onChange={(e) => setMakeModel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reefer Unit Type (Compressor)
                </label>
                <input
                  type="text"
                  required
                  value={reeferType}
                  onChange={(e) => setReeferType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Min Temp Limit (°C)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={tempMin}
                    onChange={(e) => setTempMin(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Max Temp Limit (°C)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={tempMax}
                    onChange={(e) => setTempMax(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-xs"
                >
                  {loading ? "Registering..." : "Add Vehicle to Fleet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
