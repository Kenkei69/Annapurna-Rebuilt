"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastBanner, ToastMessage } from "@/components/ui/ToastBanner";
import { FleetClient, VehicleRecord } from "./FleetClient";
import {
  Truck,
  MapPin,
  Thermometer,
  AlertTriangle,
  LifeBuoy,
  Search,
  PlusCircle,
  RotateCcw,
  Clock,
  X,
  ExternalLink,
  ChevronRight,
  Cpu,
} from "lucide-react";

// Dynamically import Leaflet FleetMap with SSR disabled
const FleetMap = dynamic(() => import("@/components/map/FleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[450px] bg-slate-900 flex flex-col items-center justify-center text-slate-400 rounded-xl">
      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
      <span className="text-xs font-mono">Loading Interactive Fleet Map...</span>
    </div>
  ),
});

export interface ShipmentConsoleRecord {
  id: string;
  trackingNumber: string;
  title: string;
  cargoType: string;
  tempMin: number;
  tempMax: number;
  status: string;
  originName: string;
  originLat?: number | null;
  originLng?: number | null;
  destName: string;
  destLat?: number | null;
  destLng?: number | null;
  latestTemperature?: number | null;
  latestHumidity?: number | null;
  latestLat?: number | null;
  latestLng?: number | null;
  latestRecordedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  assignedVehicle?: {
    id: string;
    licensePlate: string;
    makeModel: string;
    reeferType: string;
  } | null;
  assignedDevice?: {
    id: string;
    deviceIdentifier: string;
    hardwareModel: string;
    status: string;
    isSimulated?: boolean;
    lastSeenAt?: string | Date | null;
  } | null;
  assignedDriver?: {
    id: string;
    name: string;
    email: string;
  } | null;
  alerts: Array<{
    id: string;
    ruleCode: string;
    severity: string;
    status: string;
    summary: string;
    createdAt: string | Date;
  }>;
  rescueOpportunity?: {
    id: string;
    status: string;
    urgency: string;
  } | null;
}

interface FleetConsoleClientProps {
  shipments: ShipmentConsoleRecord[];
  vehicles: VehicleRecord[];
  devices: Array<{ id: string; deviceIdentifier: string; hardwareModel: string; status: string }>;
  drivers: Array<{ id: string; name: string; email: string }>;
  userRole?: string;
  organization?: { id: string; name: string; type: string };
}

export function FleetConsoleClient({
  shipments: initialShipments,
  vehicles,
  devices,
  drivers,
  userRole: _userRole,
  organization: _organization,
}: FleetConsoleClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentTimestamp] = useState(() => Date.now());

  // Navigation tab: 'console' (Fleet Tracking Console) vs 'assets' (Vehicles & Equipment)
  const [activeTab, setActiveTab] = useState<"console" | "assets">("console");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Filter States initialized from URL search params
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") || "ALL");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");
  const [tempMinFilter, setTempMinFilter] = useState(searchParams.get("tempMin") || "");
  const [tempMaxFilter, setTempMaxFilter] = useState(searchParams.get("tempMax") || "");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "DEFAULT");

  // Selection state
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(
    searchParams.get("selected") || initialShipments[0]?.id || null
  );

  // New Consignment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form inputs
  const [formTitle, setFormTitle] = useState("");
  const [formCargoType, setFormCargoType] = useState("Fresh Produce (Tomatoes)");
  const [formTempMin, setFormTempMin] = useState(2.0);
  const [formTempMax, setFormTempMax] = useState(6.0);
  const [formOrigin, setFormOrigin] = useState("Nashik Agro Hub");
  const [formDest, setFormDest] = useState("Mumbai Cold Logistics Terminal");
  const [formVehicleId, setFormVehicleId] = useState(vehicles[0]?.id || "");
  const [formDeviceId, setFormDeviceId] = useState(devices[0]?.id || "");
  const [formDriverId, setFormDriverId] = useState(drivers[0]?.id || "");

  // Sync state to URL search parameters
  const updateUrlParams = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === "" || v === "ALL" || v === "DEFAULT") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    });
    router.replace(`/fleet?${params.toString()}`, { scroll: false });
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    updateUrlParams({ search: val });
  };

  const handleCategoryChange = (val: string) => {
    setCategoryFilter(val);
    updateUrlParams({ category: val });
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    updateUrlParams({ status: val });
  };

  const handleSortChange = (val: string) => {
    setSortBy(val);
    updateUrlParams({ sortBy: val });
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("ALL");
    setStatusFilter("ALL");
    setTempMinFilter("");
    setTempMaxFilter("");
    setSortBy("DEFAULT");
    router.replace("/fleet", { scroll: false });
  };

  const handleSelectShipment = (id: string) => {
    setSelectedShipmentId(id);
    updateUrlParams({ selected: id });
  };

  // Filtered and Sorted Shipments
  const filteredShipments = useMemo(() => {
    return initialShipments
      .filter((s) => {
        // Text Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = s.title.toLowerCase().includes(q);
          const matchTrack = s.trackingNumber.toLowerCase().includes(q);
          const matchPlate = s.assignedVehicle?.licensePlate.toLowerCase().includes(q);
          const matchDriver = s.assignedDriver?.name.toLowerCase().includes(q);
          if (!matchTitle && !matchTrack && !matchPlate && !matchDriver) return false;
        }

        // Category Filter
        if (categoryFilter !== "ALL" && s.cargoType !== categoryFilter) {
          return false;
        }

        // Status Filter
        if (statusFilter !== "ALL" && s.status !== statusFilter) {
          return false;
        }

        // Temperature Min Filter
        if (tempMinFilter !== "" && s.latestTemperature != null) {
          if (s.latestTemperature < parseFloat(tempMinFilter)) return false;
        }

        // Temperature Max Filter
        if (tempMaxFilter !== "" && s.latestTemperature != null) {
          if (s.latestTemperature > parseFloat(tempMaxFilter)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "TEMP_HIGH_TO_LOW") {
          return (b.latestTemperature ?? -999) - (a.latestTemperature ?? -999);
        }
        if (sortBy === "RISK") {
          const aAlerts = a.alerts.length;
          const bAlerts = b.alerts.length;
          return bAlerts - aAlerts;
        }
        if (sortBy === "UPDATED") {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [
    initialShipments,
    searchQuery,
    categoryFilter,
    statusFilter,
    tempMinFilter,
    tempMaxFilter,
    sortBy,
  ]);

  // Selected shipment object
  const selectedShipment = useMemo(() => {
    if (!selectedShipmentId) return filteredShipments[0] || null;
    return (
      initialShipments.find((s) => s.id === selectedShipmentId) ||
      filteredShipments[0] ||
      null
    );
  }, [selectedShipmentId, initialShipments, filteredShipments]);

  // Overall Fleet Risk Metrics
  const metrics = useMemo(() => {
    const totalActive = initialShipments.filter(
      (s) => s.status !== "DELIVERED" && s.status !== "CANCELLED"
    ).length;
    const inTransit = initialShipments.filter((s) => s.status === "IN_TRANSIT").length;
    const alerted = initialShipments.filter(
      (s) => s.status === "ALERTED" || s.status === "RESCUE_PENDING"
    ).length;

    // Calculate average temperature of active units with telemetry
    const temps = initialShipments
      .filter((s) => s.latestTemperature != null && s.status !== "DELIVERED")
      .map((s) => s.latestTemperature as number);
    const avgTemp =
      temps.length > 0
        ? (temps.reduce((acc, t) => acc + t, 0) / temps.length).toFixed(1)
        : null;

    return { totalActive, inTransit, alerted, avgTemp };
  }, [initialShipments]);

  // Calculate connection freshness
  const getConnectionFreshness = (recordedAt?: string | Date | null) => {
    if (!recordedAt) return { label: "No Telemetry", status: "offline" };
    const diffMs = currentTimestamp - new Date(recordedAt).getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 5) return { label: `Live • ${diffMins}m ago`, status: "live" };
    if (diffMins < 30) return { label: `Recent • ${diffMins}m ago`, status: "recent" };
    return { label: `Stale • ${diffMins}m offline`, status: "stale" };
  };

  // Handle Consignment Creation
  const handleCreateConsignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formTempMin >= formTempMax) {
      setFormError("Safe Minimum Temperature must be strictly less than Maximum Temperature.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          cargoType: formCargoType,
          tempMin: formTempMin,
          tempMax: formTempMax,
          originName: formOrigin,
          originLat: 19.9975,
          originLng: 73.7898,
          destName: formDest,
          destLat: 19.076,
          destLng: 72.8777,
          assignedVehicleId: formVehicleId || undefined,
          assignedDeviceId: formDeviceId || undefined,
          assignedDriverId: formDriverId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create consignment");
      }

      setToast({
        type: "success",
        message: `Consignment created successfully (${data.trackingNumber})`,
      });
      setShowCreateModal(false);
      setFormTitle("");
      router.refresh();
      if (data.id) {
        setSelectedShipmentId(data.id);
      }
    } catch (err: unknown) {
      setFormError((err as Error).message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Messages */}
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Fleet Command Console
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live Operations
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time geospatial tracking, reefer temperature bounds, and cargo integrity monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center text-xs font-semibold">
            <button
              onClick={() => setActiveTab("console")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "console"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <MapPin size={14} className="text-emerald-600" />
              <span>Map Console</span>
            </button>
            <button
              onClick={() => setActiveTab("assets")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "assets"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Truck size={14} className="text-slate-500" />
              <span>Vehicles &amp; Equipment</span>
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <PlusCircle size={15} />
            <span>New Consignment</span>
          </button>
        </div>
      </div>

      {activeTab === "assets" ? (
        /* Preserved Vehicle Management View */
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <FleetClient vehicles={vehicles} />
        </div>
      ) : (
        /* Map-Centered Fleet Console View */
        <div className="space-y-4">
          {/* Risk Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3 px-3 py-1">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Truck size={20} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Active Consignments
                </p>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {metrics.totalActive}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 py-1 border-l border-slate-100">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <MapPin size={20} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  In Transit
                </p>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {metrics.inTransit}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 py-1 border-l border-slate-100">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  metrics.alerted > 0
                    ? "bg-red-50 text-red-600 animate-pulse"
                    : "bg-slate-50 text-slate-400"
                }`}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Alerted / Breach
                </p>
                <p
                  className={`text-xl font-bold font-mono ${
                    metrics.alerted > 0 ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  {metrics.alerted}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 py-1 border-l border-slate-100">
              <div className="w-10 h-10 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
                <Thermometer size={20} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Avg Reefer Temp
                </p>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {metrics.avgTemp != null ? `${metrics.avgTemp}°C` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Filtering & Search Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search truck plate, driver, tracking #..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Category */}
              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
              >
                <option value="ALL">All Cargo Categories</option>
                <option value="Produce">Produce / Fruits &amp; Veg</option>
                <option value="Dairy">Dairy Products</option>
                <option value="Biologics">Biologics &amp; Vaccines</option>
                <option value="Pharmaceuticals">Pharmaceuticals</option>
                <option value="Frozen">Frozen Meat / Seafood</option>
              </select>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
              >
                <option value="ALL">All Operational Statuses</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="ALERTED">Alerted</option>
                <option value="RESCUE_PENDING">Rescue Pending</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="RESCUED">Rescued</option>
                <option value="DELIVERED">Delivered</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
              >
                <option value="DEFAULT">Sort: Default</option>
                <option value="TEMP_HIGH_TO_LOW">Sort: Temp (High to Low)</option>
                <option value="RISK">Sort: Risk / Alerts Count</option>
                <option value="UPDATED">Sort: Recently Updated</option>
              </select>
            </div>

            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors font-medium text-xs"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          </div>

          {/* Main 3-Column Console Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column: Consignment List (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[680px]">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Active Consignments
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Showing {filteredShipments.length} of {initialShipments.length} records
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {filteredShipments.length} live
                </span>
              </div>

              {/* List Scroll Area */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {filteredShipments.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-sm font-medium">No consignments match query</p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-xs font-medium"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  filteredShipments.map((s) => {
                    const isSelected = s.id === selectedShipment?.id;
                    const freshness = getConnectionFreshness(s.latestRecordedAt);
                    const isAlert = s.status === "ALERTED" || s.status === "RESCUE_PENDING";
                    const isTempBreach =
                      s.latestTemperature != null &&
                      (s.latestTemperature > s.tempMax || s.latestTemperature < s.tempMin);

                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectShipment(s.id)}
                        className={`p-3.5 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-emerald-50/70 border-l-4 border-l-emerald-600 pl-2.5"
                            : isAlert
                            ? "bg-red-50/40 border-l-4 border-l-red-500 pl-2.5 hover:bg-red-50/60"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {s.trackingNumber}
                          </span>
                          <StatusBadge status={s.status} />
                        </div>

                        <p className="text-xs font-semibold text-slate-800 mt-1 line-clamp-1">
                          {s.title}
                        </p>

                        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 font-mono">
                            <Truck size={12} className="text-slate-400" />
                            <span>{s.assignedVehicle?.licensePlate || "No Vehicle"}</span>
                          </span>

                          {/* Temperature Pill */}
                          {s.latestTemperature != null ? (
                            <span
                              className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                                isTempBreach
                                  ? "bg-red-100 text-red-700 border border-red-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {s.latestTemperature.toFixed(1)}°C
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No temp</span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100/80 pt-1.5">
                          <span className="truncate max-w-[160px]">
                            {s.originName.split(" ")[0]} → {s.destName.split(" ")[0]}
                          </span>
                          <span
                            className={`font-mono ${
                              freshness.status === "live"
                                ? "text-emerald-600 font-semibold"
                                : freshness.status === "recent"
                                ? "text-slate-500"
                                : "text-amber-600"
                            }`}
                          >
                            {freshness.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Center Column: Interactive Fleet Map (5 cols) */}
            <div className="lg:col-span-5 flex flex-col h-[680px]">
              <FleetMap
                shipments={filteredShipments}
                selectedShipmentId={selectedShipment?.id}
                onSelectShipment={handleSelectShipment}
                className="w-full h-full min-h-[680px]"
              />
            </div>

            {/* Right Column: Selected Consignment Health Panel (3 cols) */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[680px] p-4 overflow-y-auto">
              {selectedShipment ? (
                <div className="space-y-4">
                  {/* Title & Tracking */}
                  <div className="border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Consignment Health
                      </span>
                      <StatusBadge status={selectedShipment.status} />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">
                      {selectedShipment.title}
                    </h3>
                    <p className="font-mono text-xs text-emerald-700 font-semibold mt-0.5">
                      {selectedShipment.trackingNumber}
                    </p>
                  </div>

                  {/* Temperature Monitor Gauge */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span className="flex items-center gap-1">
                        <Thermometer size={14} className="text-emerald-600" />
                        <span>Core Reefer Temp</span>
                      </span>
                      {selectedShipment.latestTemperature != null && (
                        <span className="font-mono text-base font-bold text-slate-900">
                          {selectedShipment.latestTemperature.toFixed(1)}°C
                        </span>
                      )}
                    </div>

                    {/* Safe Band Visual Bar */}
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                        <span>Safe: {selectedShipment.tempMin}°C</span>
                        <span>Max: {selectedShipment.tempMax}°C</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{
                            width: "100%",
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    </div>

                    {/* Connection Freshness / Observed At */}
                    <div className="mt-3 flex items-center justify-between text-[11px] border-t border-slate-200/60 pt-2 text-slate-500">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock size={12} className="text-slate-400" />
                        <span>Observed:</span>
                      </span>
                      <span className="font-mono font-medium text-slate-700">
                        {selectedShipment.latestRecordedAt
                          ? new Date(selectedShipment.latestRecordedAt).toLocaleTimeString()
                          : "Never"}
                      </span>
                    </div>

                    {/* Provenance Label */}
                    <div className="mt-1 text-[10px] text-slate-400 font-mono flex items-center justify-between">
                      <span>Source:</span>
                      <span className="text-slate-600">
                        {selectedShipment.assignedDevice?.isSimulated
                          ? "Simulator Edge Device"
                          : selectedShipment.assignedDevice
                          ? "Authenticated IoT Hardware"
                          : "Seeded / Unbound"}
                      </span>
                    </div>
                  </div>

                  {/* Auxiliary Sensors — Truthful disclosure */}
                  <div className="text-xs space-y-1.5 border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Relative Humidity:</span>
                      <span className="font-mono text-slate-700">
                        {selectedShipment.latestHumidity != null
                          ? `${selectedShipment.latestHumidity.toFixed(0)}%`
                          : "Unavailable"}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Ethylene Sensor:</span>
                      <span className="text-slate-400 italic">Not equipped</span>
                    </div>
                  </div>

                  {/* Asset & Driver Info */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                        Assigned Vehicle
                      </span>
                      <p className="font-mono font-medium text-slate-800 mt-0.5">
                        {selectedShipment.assignedVehicle?.licensePlate || "Unassigned"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {selectedShipment.assignedVehicle?.makeModel || "Standard Reefer"}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                        Assigned Driver
                      </span>
                      <p className="font-medium text-slate-800 mt-0.5">
                        {selectedShipment.assignedDriver?.name || "Unassigned"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {selectedShipment.assignedDriver?.email || "—"}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                        Route Corridor
                      </span>
                      <p className="text-[11px] text-slate-700 mt-0.5">
                        <strong>From:</strong> {selectedShipment.originName}
                      </p>
                      <p className="text-[11px] text-slate-700">
                        <strong>To:</strong> {selectedShipment.destName}
                      </p>
                    </div>
                  </div>

                  {/* Active Incidents / Alerts */}
                  {selectedShipment.alerts.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-red-800 font-bold text-xs">
                        <AlertTriangle size={14} className="text-red-600" />
                        <span>Active Incident ({selectedShipment.alerts.length})</span>
                      </div>
                      <p className="text-[11px] text-red-700 mt-1 line-clamp-2">
                        {selectedShipment.alerts[0].summary}
                      </p>
                      <Link
                        href="/alerts"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-red-800 hover:underline"
                      >
                        <span>Manage in Alert Center</span>
                        <ChevronRight size={12} />
                      </Link>
                    </div>
                  )}

                  {/* Operational Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <Link
                      href={`/shipments/${selectedShipment.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      <span>Full Telemetry &amp; Audit Trail</span>
                      <ExternalLink size={13} />
                    </Link>

                    {selectedShipment.status === "ALERTED" && (
                      <Link
                        href="/rescue"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                      >
                        <LifeBuoy size={14} />
                        <span>Broadcast Rescue Opportunity</span>
                      </Link>
                    )}

                    <Link
                      href="/simulator"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Cpu size={14} className="text-emerald-600" />
                      <span>Test with Sensor Simulator</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <MapPin size={32} className="text-slate-300 mb-2" />
                  <p className="text-xs font-medium">Select a consignment to view live health</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Consignment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="text-emerald-600 w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-base">New Consignment Dispatch</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateConsignment} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Consignment Title / Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Export Tomatoes Batch #441"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Cargo Category *
                  </label>
                  <select
                    value={formCargoType}
                    onChange={(e) => setFormCargoType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Produce">Produce (Vegetables / Fruits)</option>
                    <option value="Dairy">Dairy (Milk / Cheese / Butter)</option>
                    <option value="Biologics">Biologics (Vaccines / Serums)</option>
                    <option value="Pharmaceuticals">Pharmaceuticals</option>
                    <option value="Frozen">Frozen Meat / Seafood</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Assigned Vehicle *
                  </label>
                  <select
                    value={formVehicleId}
                    onChange={(e) => setFormVehicleId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-[11px]"
                  >
                    <option value="">No Vehicle Assigned</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.licensePlate} ({v.makeModel})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Temperature Bounds */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Safe Min Temp (°C) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={formTempMin}
                    onChange={(e) => setFormTempMin(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Safe Max Temp (°C) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={formTempMax}
                    onChange={(e) => setFormTempMax(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Origin Corridor *
                  </label>
                  <input
                    type="text"
                    required
                    value={formOrigin}
                    onChange={(e) => setFormOrigin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Destination *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDest}
                    onChange={(e) => setFormDest(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Edge IoT Device
                  </label>
                  <select
                    value={formDeviceId}
                    onChange={(e) => setFormDeviceId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px]"
                  >
                    <option value="">No IoT Device</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.deviceIdentifier} ({d.hardwareModel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Assigned Driver
                  </label>
                  <select
                    value={formDriverId}
                    onChange={(e) => setFormDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-[11px]"
                  >
                    <option value="">No Driver Assigned</option>
                    {drivers.map((dr) => (
                      <option key={dr.id} value={dr.id}>
                        {dr.name} ({dr.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? "Dispatching..." : "Dispatch Consignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
