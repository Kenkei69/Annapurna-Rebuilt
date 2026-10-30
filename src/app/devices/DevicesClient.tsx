"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastBanner, ToastMessage } from "@/components/ui/ToastBanner";
import {
  PlusCircle,
  Copy,
  Check,
  KeyRound,
  Cpu,
  X,
  Search,
  Filter,
} from "lucide-react";

export interface DeviceRecord {
  id: string;
  deviceIdentifier: string;
  hardwareModel: string;
  status: "ACTIVE" | "SUSPENDED" | "DECOMMISSIONED";
  isSimulated: boolean;
  lastSeenAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  organizationId: string;
  shipments?: Array<{
    id: string;
    trackingNumber: string;
    title: string;
    status: string;
  }>;
}

interface DevicesClientProps {
  devices: DeviceRecord[];
}

export function DevicesClient({ devices }: DevicesClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [hardwareModel, setHardwareModel] = useState("ANNAPURNA-EDGE-S3");
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actingDeviceId, setActingDeviceId] = useState<string | null>(null);

  // Keyboard shortcut to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceIdentifier: deviceIdentifier.trim(), hardwareModel: hardwareModel.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to provision device");
      }

      setNewKey(data.apiKey);
      setToast({
        type: "success",
        message: `Device ${deviceIdentifier} provisioned successfully. Flash edge credentials now.`,
      });
      router.refresh();
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to provision device",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    deviceId: string,
    targetStatus: "ACTIVE" | "SUSPENDED" | "DECOMMISSIONED"
  ) => {
    const reasonPrompt =
      targetStatus === "DECOMMISSIONED"
        ? "Please confirm permanent decommissioning reason (e.g. Hardware retirement or loss):"
        : `Confirm reason to transition device to ${targetStatus}:`;

    const reason = window.prompt(reasonPrompt, `Manual administrative transition to ${targetStatus}`);
    if (!reason || !reason.trim()) return;

    try {
      setActingDeviceId(deviceId);
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus, reason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to transition device status`);
      }

      setToast({
        type: "success",
        message: `Device status changed to ${targetStatus}.`,
      });
      router.refresh();
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Status transition failed",
      });
    } finally {
      setActingDeviceId(null);
    }
  };

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredDevices = devices.filter((d) => {
    if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        d.deviceIdentifier.toLowerCase().includes(q) ||
        d.hardwareModel.toLowerCase().includes(q) ||
        (d.shipments?.[0]?.trackingNumber.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IoT Edge Devices</h1>
          <p className="text-xs text-slate-500 mt-1">
            Provisioned telemetry sensors, cryptographic token authentication, revocation &amp; connectivity tracking
          </p>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setNewKey(null);
            setDeviceIdentifier(`APN-EDGE-${Date.now().toString().slice(-4)}`);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <PlusCircle size={16} />
          <span>Provision Edge Device</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by device UUID, hardware model, or assigned tracking..."
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
            <option value="ALL">All Statuses ({devices.length})</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DECOMMISSIONED">Decommissioned</option>
          </select>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Device Identifier</th>
                <th className="px-6 py-3">Hardware Model</th>
                <th className="px-6 py-3">Assigned Active Shipment</th>
                <th className="px-6 py-3">Last Seen</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    {devices.length === 0
                      ? "No devices provisioned for this organization."
                      : "No devices match the active search/filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredDevices.map((d) => {
                  const activeShipment = d.shipments?.[0];
                  const isBusy = actingDeviceId === d.id;

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Cpu size={14} className="text-slate-400" />
                          <span>{d.deviceIdentifier}</span>
                          {d.isSimulated && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-sans font-semibold">
                              Simulated
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {d.hardwareModel}
                      </td>

                      <td className="px-6 py-4">
                        {activeShipment ? (
                          <Link
                            href={`/shipments/${activeShipment.id}`}
                            className="font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
                          >
                            <span>{activeShipment.trackingNumber}</span>
                            <span className="text-slate-400 font-normal">({activeShipment.title})</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned (Standby)</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-slate-500">
                        {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "Never"}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={d.status} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {d.status === "ACTIVE" && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleStatusChange(d.id, "SUSPENDED")}
                              title="Suspend telemetry reception"
                              className="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px] font-medium transition-colors"
                            >
                              Suspend
                            </button>
                          )}
                          {d.status === "SUSPENDED" && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleStatusChange(d.id, "ACTIVE")}
                              title="Reactivate device telemetry"
                              className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-medium transition-colors"
                            >
                              Activate
                            </button>
                          )}
                          {d.status !== "DECOMMISSIONED" && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleStatusChange(d.id, "DECOMMISSIONED")}
                              title="Permanently decommission device"
                              className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-medium transition-colors"
                            >
                              Decommission
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisioning Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-2">Provision IoT Edge Device</h3>
            <p className="text-xs text-slate-500 mb-4">
              Generates a secure cryptographic device key. Hashed with SHA-256 before persistence.
            </p>

            {newKey ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <p className="font-bold mb-1 flex items-center gap-1.5">
                    <KeyRound size={14} className="text-amber-700" />
                    <span>Device Secret Generated (One-Time View)</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Copy this key immediately to flash onto your ESP32 / STM32 reefer monitor. It will
                    NOT be displayed again.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Plain Device API Key
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={newKey}
                      className="w-full text-xs font-mono px-3 py-2 bg-slate-100 border border-slate-300 rounded select-all"
                    />
                    <button
                      onClick={copyKey}
                      className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded shrink-0 transition-colors"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Done &amp; Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProvision} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Device Identifier (Hardware UUID / Serial)
                  </label>
                  <input
                    type="text"
                    required
                    value={deviceIdentifier}
                    onChange={(e) => setDeviceIdentifier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Hardware Model Specification
                  </label>
                  <input
                    type="text"
                    required
                    value={hardwareModel}
                    onChange={(e) => setHardwareModel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
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
                    {loading ? "Provisioning..." : "Generate Device Credentials"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
