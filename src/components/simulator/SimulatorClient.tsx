"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ToastBanner, ToastMessage } from "@/components/ui/ToastBanner";
import {
  PlayCircle,
  Thermometer,
  ShieldAlert,
  Clock,
  Copy,
  Radio,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

interface SimulatorClientProps {
  devices: any[];
}

export function SimulatorClient({ devices }: SimulatorClientProps) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [selectedDevice, setSelectedDevice] = useState(
    devices[0]?.deviceIdentifier || "DEVICE-APN-001"
  );
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const scenarios = [
    {
      id: "NORMAL",
      title: "Normal In-Transit Telemetry",
      desc: "Simulates compliant reefer operation. Injects 3 sequential readings within allowed cargo thresholds.",
      badge: "Safe Operation",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: Thermometer,
    },
    {
      id: "GRADUAL_WARMING",
      title: "Reefer Compressor Failure (Warming)",
      desc: "Simulates mechanical refrigeration failure. Injects rising temperatures (+4.1°C breach) to trigger SUSTAINED_BREACH alert.",
      badge: "Triggers Critical Alert",
      badgeColor: "bg-red-50 text-red-700 border-red-200",
      icon: ShieldAlert,
    },
    {
      id: "DOOR_AJAR",
      title: "Door Ajar & Thermal Shock",
      desc: "Simulates unsealed door or loading breach with rapid thermal spike (+6°C) and 95% relative humidity.",
      badge: "Thermal Shock",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Radio,
    },
    {
      id: "SENSOR_OFFLINE",
      title: "Delayed Message / Connectivity Concern",
      desc: "Simulates cellular drop-off by injecting a reading timestamped 45 minutes in the past to test stale telemetry logic.",
      badge: "Stale Reading",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      icon: Clock,
    },
    {
      id: "REPLAY_DUPLICATE",
      title: "Network Replay / Idempotent Retry",
      desc: "Re-transmits identical sequence identifier to verify PostgreSQL unique constraint and deduplication.",
      badge: "Deduplication Test",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      icon: Copy,
    },
  ];

  const handleRunScenario = async (scenarioId: string) => {
    try {
      setLoadingScenario(scenarioId);
      const res = await fetch("/api/simulator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDevice,
          scenario: scenarioId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Simulation run failed");
      }

      setLastResult(data.result);
      setToast({
        type: "success",
        message: `Simulation scenario '${scenarioId}' completed successfully. ${data.result?.readingsInjected ?? 0} reading(s) injected.`,
      });
    } catch (err: any) {
      setToast({ type: "error", message: `Simulation failed: ${err.message}` });
    } finally {
      setLoadingScenario(null);
    }
  };

  const currentDev = devices.find((d) => d.deviceIdentifier === selectedDevice);
  const activeShipment = currentDev?.shipments?.[0];

  return (
    <div className="space-y-6">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      {/* Simulation Warning & Provenance Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
          <PlayCircle size={20} />
        </div>
        <div className="text-xs">
          <p className="font-bold text-amber-900">
            DEMONSTRATION &amp; TEST HARNESS — CLEARLY LABELED SIMULATOR
          </p>
          <p className="text-amber-700 mt-0.5 leading-relaxed">
            All synthetic sensor packets emitted by this tool are explicitly flagged with{" "}
            <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono font-bold">
              isSimulated: true
            </code>
            . Real edge hardware uses independent HMAC-signed API tokens.
          </p>
        </div>
      </div>

      {/* Target Device Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Target IoT Edge Device
          </label>
          <div className="flex items-center gap-3">
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-semibold"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.deviceIdentifier}>
                  {d.deviceIdentifier} — {d.hardwareModel}
                </option>
              ))}
            </select>
            {activeShipment && (
              <span className="text-xs text-slate-600">
                Assigned to:{" "}
                <Link
                  href={`/shipments/${activeShipment.id}`}
                  className="font-bold text-emerald-700 hover:underline"
                >
                  {activeShipment.trackingNumber} ({activeShipment.cargoType})
                </Link>
              </span>
            )}
          </div>
        </div>

        {activeShipment && (
          <Link
            href={`/shipments/${activeShipment.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 shrink-0"
          >
            <span>Inspect Live Shipment</span>
            <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {/* Scenario Execution Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isLoading = loadingScenario === sc.id;

          return (
            <div
              key={sc.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                    <Icon size={18} />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${sc.badgeColor}`}
                  >
                    {sc.badge}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mb-1">{sc.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{sc.desc}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleRunScenario(sc.id)}
                  disabled={isLoading || loadingScenario !== null}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Transmitting Telemetry...</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle size={14} className="text-emerald-400" />
                      <span>Inject Scenario</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Simulator Execution Results Panel */}
      {lastResult && (
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <h3 className="font-bold text-sm text-white">
                Simulation Execution Output — Scenario: {lastResult.scenario}
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Target: {lastResult.deviceId}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase">Readings Injected</span>
              <p className="font-mono font-bold text-lg text-emerald-400 mt-1">
                {lastResult.readingsInjected}
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase">Alerts Triggered</span>
              <p
                className={`font-mono font-bold text-lg mt-1 ${
                  lastResult.triggeredAlerts > 0 ? "text-red-400" : "text-slate-300"
                }`}
              >
                {lastResult.triggeredAlerts}
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase">Deduplication State</span>
              <p className="font-mono font-bold text-slate-200 mt-1">Enforced</p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase">Authoritative Sync</span>
              <p className="font-mono font-bold text-slate-200 mt-1">PostgreSQL ACID</p>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
            <p className="text-slate-400 font-semibold mb-2 font-sans">Execution Trace Log:</p>
            {lastResult.details?.map((line: string, i: number) => (
              <p key={i} className="text-emerald-400">
                &gt; {line}
              </p>
            ))}
          </div>

          {activeShipment && (
            <div className="flex justify-end pt-2">
              <Link
                href={`/shipments/${activeShipment.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                <span>Inspect Updated Shipment ({activeShipment.trackingNumber})</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
