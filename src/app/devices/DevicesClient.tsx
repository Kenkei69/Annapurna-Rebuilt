"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Cpu, PlusCircle, Copy, Check, ShieldAlert, KeyRound, Radio } from "lucide-react";

interface DevicesClientProps {
  devices: any[];
}

export function DevicesClient({ devices }: DevicesClientProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [hardwareModel, setHardwareModel] = useState("ANNAPURNA-EDGE-S3");
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceIdentifier, hardwareModel }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to provision device");
      }

      setNewKey(data.plainApiKey);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IoT Edge Devices</h1>
          <p className="text-xs text-slate-500 mt-1">
            Provisioned telemetry sensors, cryptographic token authentication &amp; connectivity tracking
          </p>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setNewKey(null);
            setDeviceIdentifier(`DEVICE-APN-${Date.now().toString().slice(-4)}`);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <PlusCircle size={16} />
          <span>Provision Edge Device</span>
        </button>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No devices provisioned for this organization.
                  </td>
                </tr>
              ) : (
                devices.map((d) => {
                  const activeShipment = d.shipments?.[0];

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        {d.deviceIdentifier}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {d.hardwareModel}
                      </td>

                      <td className="px-6 py-4">
                        {activeShipment ? (
                          <Link
                            href={`/shipments/${activeShipment.id}`}
                            className="font-bold text-emerald-700 hover:underline"
                          >
                            {activeShipment.trackingNumber} ({activeShipment.title})
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
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
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
                      className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded shrink-0"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
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
