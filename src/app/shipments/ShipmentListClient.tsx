"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastBanner, ToastMessage } from "@/components/ui/ToastBanner";
import {
  PlusCircle,
  ArrowRight,
  PlayCircle,
  Search,
  Filter,
  Truck,
  MapPin,
  Clock,
  X,
  AlertTriangle,
  LifeBuoy,
} from "lucide-react";

export interface ShipmentListItem {
  id: string;
  organizationId: string;
  trackingNumber: string;
  title: string;
  cargoType: string;
  tempMin: number;
  tempMax: number;
  status: string;
  originName: string;
  destName: string;
  latestTemperature: number | null;
  latestRecordedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  assignedVehicle?: {
    id: string;
    licensePlate: string;
    makeModel: string;
    reeferType: string;
    status: string;
  } | null;
  assignedDevice?: {
    id: string;
    deviceIdentifier: string;
    hardwareModel: string;
    status: string;
    lastSeenAt: string | Date | null;
  } | null;
  alerts?: Array<{
    id: string;
    ruleCode: string;
    severity: string;
    status: string;
    summary: string;
  }>;
  rescueOpportunity?: {
    id: string;
    status: string;
    title: string;
    urgency: string;
    acceptedOfferId: string | null;
  } | null;
}

export interface VehicleOption {
  id: string;
  licensePlate: string;
  makeModel: string;
  reeferType: string;
  status: string;
}

export interface DeviceOption {
  id: string;
  deviceIdentifier: string;
  hardwareModel: string;
  status: string;
  lastSeenAt: string | Date | null;
}

export interface DriverOption {
  id: string;
  name: string;
  email: string;
}

interface ShipmentListClientProps {
  shipments: ShipmentListItem[];
  vehicles: VehicleOption[];
  devices: DeviceOption[];
  drivers: DriverOption[];
  isOperator: boolean;
}

const CARGO_PRESETS: Record<string, { min: number; max: number }> = {
  "Fresh Produce": { min: 1.0, max: 4.0 },
  "Dairy Products": { min: 2.0, max: 5.5 },
  "Pharmaceuticals & Vaccines": { min: 2.0, max: 6.0 },
  "Frozen Meats": { min: -22.0, max: -18.0 },
  "Chilled Seafood": { min: -1.0, max: 2.0 },
};

function formatAge(dateStr: string | Date | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ShipmentListClient({
  shipments,
  vehicles,
  devices,
  drivers,
  isOperator,
}: ShipmentListClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [cargoType, setCargoType] = useState("Fresh Produce");
  const [tempMin, setTempMin] = useState(1.0);
  const [tempMax, setTempMax] = useState(4.0);
  const [originName, setOriginName] = useState("");
  const [destName, setDestName] = useState("");
  const [assignedVehicleId, setAssignedVehicleId] = useState("");
  const [assignedDeviceId, setAssignedDeviceId] = useState("");
  const [assignedDriverId, setAssignedDriverId] = useState("");

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const handleCargoChange = (cat: string) => {
    setCargoType(cat);
    if (CARGO_PRESETS[cat]) {
      setTempMin(CARGO_PRESETS[cat].min);
      setTempMax(CARGO_PRESETS[cat].max);
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tempMin >= tempMax) {
      setToast({
        type: "error",
        message: "Minimum temperature threshold must be strictly less than maximum threshold.",
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          cargoType: cargoType.trim(),
          tempMin: Number(tempMin),
          tempMax: Number(tempMax),
          originName: originName.trim(),
          destName: destName.trim(),
          ...(assignedVehicleId ? { assignedVehicleId } : {}),
          ...(assignedDeviceId ? { assignedDeviceId } : {}),
          ...(assignedDriverId ? { assignedDriverId } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create shipment");
      }

      setShowModal(false);
      setTitle("");
      setOriginName("");
      setDestName("");
      setAssignedVehicleId("");
      setAssignedDeviceId("");
      setAssignedDriverId("");
      setToast({
        type: "success",
        message: `Shipment ${data.shipment?.trackingNumber || "draft"} created successfully.`,
      });
      router.refresh();
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to create shipment",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredShipments = shipments.filter((s) => {
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        s.trackingNumber.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.cargoType.toLowerCase().includes(q) ||
        s.originName.toLowerCase().includes(q) ||
        s.destName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / pageSize));
  const paginatedShipments = filteredShipments.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

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
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold border border-slate-300 transition-colors"
          >
            <PlayCircle size={15} className="text-emerald-700" />
            <span>Launch Simulator</span>
          </Link>

          {isOperator && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <PlusCircle size={16} />
              <span>Create Shipment</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by tracking code, cargo type, route..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Statuses ({shipments.length})</option>
            <option value="DRAFT">Draft</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="ALERTED">Alerted</option>
            <option value="RESCUE_PENDING">Rescue Pending</option>
            <option value="RESCUED">Rescued</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

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
              {paginatedShipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    {shipments.length === 0
                      ? "No shipments registered for this organization."
                      : "No shipments match the search criteria."}
                  </td>
                </tr>
              ) : (
                paginatedShipments.map((s) => {
                  const hasActiveAlert = (s.alerts ?? []).length > 0;
                  const isRescue = s.status === "RESCUE_PENDING";

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/shipments/${s.id}`}
                            className="font-mono font-bold text-slate-900 hover:text-emerald-700 transition-colors"
                          >
                            {s.trackingNumber}
                          </Link>
                          {hasActiveAlert && (
                            <span className="p-1 rounded bg-rose-50 text-rose-600" title="Active Thermal Breach">
                              <AlertTriangle size={13} />
                            </span>
                          )}
                          {isRescue && (
                            <span className="p-1 rounded bg-blue-50 text-blue-600" title="Rescue Operation Active">
                              <LifeBuoy size={13} />
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 font-medium mt-0.5">{s.title}</div>
                        <div className="text-[11px] text-slate-400">{s.cargoType}</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[120px]">{s.originName}</span>
                          <span className="text-slate-400">→</span>
                          <span className="truncate max-w-[120px]">{s.destName}</span>
                        </div>
                        {s.assignedVehicle && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                            <Truck size={11} />
                            <span>{s.assignedVehicle.licensePlate}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 font-mono text-slate-600">
                        {s.tempMin}°C to {s.tempMax}°C
                      </td>

                      <td className="px-6 py-4 text-right">
                        {s.latestTemperature !== null && s.latestTemperature !== undefined ? (
                          <div className="flex flex-col items-end">
                            <span
                              className={`font-mono font-bold text-sm ${
                                s.latestTemperature > s.tempMax || s.latestTemperature < s.tempMin
                                  ? "text-rose-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {s.latestTemperature.toFixed(1)}°C
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock size={10} />
                              {formatAge(s.latestRecordedAt)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No telemetry</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={s.status} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/shipments/${s.id}`}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold transition-colors"
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredShipments.length)} of {filteredShipments.length} shipments
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

      {/* Create Shipment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">Create Cold-Chain Shipment</h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure perishable cargo envelope, route endpoints, and assign fleet assets for real-time monitoring.
            </p>

            <form onSubmit={handleCreateShipment} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Shipment Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Export Alphonso Mangoes"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Cargo Category &amp; Calibrated Envelope
                  </label>
                  <select
                    value={cargoType}
                    onChange={(e) => handleCargoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Fresh Produce">Fresh Produce (1°C to 4°C)</option>
                    <option value="Dairy Products">Dairy Products (2°C to 5.5°C)</option>
                    <option value="Pharmaceuticals &amp; Vaccines">Pharmaceuticals &amp; Vaccines (2°C to 6°C)</option>
                    <option value="Frozen Meats">Frozen Meats (-22°C to -18°C)</option>
                    <option value="Chilled Seafood">Chilled Seafood (-1°C to 2°C)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Origin Hub
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pune Central Depot"
                    value={originName}
                    onChange={(e) => setOriginName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Destination Terminal
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mumbai Port Terminal"
                    value={destName}
                    onChange={(e) => setDestName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assign Reefer Vehicle
                  </label>
                  <select
                    value={assignedVehicleId}
                    onChange={(e) => setAssignedVehicleId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Unassigned (Standby)</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.licensePlate} ({v.makeModel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assign IoT Edge Sensor
                  </label>
                  <select
                    value={assignedDeviceId}
                    onChange={(e) => setAssignedDeviceId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Unassigned (Standby)</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.deviceIdentifier} ({d.hardwareModel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assign Driver
                  </label>
                  <select
                    value={assignedDriverId}
                    onChange={(e) => setAssignedDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Unassigned</option>
                    {drivers.map((dr) => (
                      <option key={dr.id} value={dr.id}>
                        {dr.name} ({dr.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-medium hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                >
                  {submitting ? "Creating..." : "Provision & Dispatch Shipment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
