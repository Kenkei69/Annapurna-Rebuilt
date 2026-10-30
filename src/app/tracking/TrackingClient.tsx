"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface PublicShipment {
  trackingNumber: string;
  title: string;
  cargoType: string;
  status: string;
  tempMin: number;
  tempMax: number;
  originName: string;
  destName: string;
  latestTemperature?: number | null;
  latestRecordedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedVehicle?: {
    makeModel: string;
    reeferType: string;
  } | null;
  alerts?: Array<{
    ruleCode: string;
    severity: string;
    summary: string;
  }>;
}

export function TrackingClient() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [shipment, setShipment] = useState<PublicShipment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleNumbers = ["APN-202610-02", "APN-DEMO-001", "COAST-2026-99"];

  const handleLookup = async (queryNum?: string) => {
    const num = (queryNum || trackingNumber).trim();
    if (!num) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/shipments/public-track?trackingNumber=${encodeURIComponent(num)}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Consignment not found");
      }

      setShipment(data.shipment);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to retrieve tracking information.");
      setShipment(null);
    } finally {
      setLoading(false);
    }
  };

  const getStepProgress = (status: string) => {
    switch (status) {
      case "DRAFT":
        return 1;
      case "DISPATCHED":
        return 2;
      case "IN_TRANSIT":
      case "ALERTED":
        return 3;
      case "RESCUE_PENDING":
      case "RESCUED":
        return 3;
      case "DELIVERED":
        return 4;
      default:
        return 2;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-base">
              A
            </div>
            <span className="font-bold text-base text-white tracking-tight">
              Annapurna <span className="text-emerald-400">Public Tracking</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              Platform Home
            </Link>
            <Link
              href="/login"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Operator Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero & Search */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>End-to-End Cold Chain Provenance</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Track Your Consignment
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
            Verify real-time thermal integrity, live corridor position, and reefer telemetry
            without exposing operational credentials.
          </p>
        </div>

        {/* Search Input Box */}
        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 shadow-xl max-w-xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Enter Consignment ID (e.g. APN-DEMO-001)"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{loading ? "Searching..." : "Track"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Quick Sample Links */}
          <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Sample queries:</span>
            <div className="flex gap-2">
              {sampleNumbers.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setTrackingNumber(s);
                    handleLookup(s);
                  }}
                  className="font-mono text-emerald-400 hover:underline hover:text-emerald-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-xl mx-auto bg-red-950/60 border border-red-800 text-red-200 p-4 rounded-xl text-sm flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Consignment Lookup Notice</p>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Active Result Card */}
        {shipment && (
          <div className="bg-slate-800/90 rounded-2xl border border-slate-700 p-6 shadow-2xl space-y-6 animate-in fade-in duration-300">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-emerald-400">
                    {shipment.trackingNumber}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-200 border border-slate-600">
                    {shipment.cargoType}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">{shipment.title}</h2>
              </div>

              {/* Temperature Badge */}
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                  Reefer Core Temp
                </p>
                <div className="flex items-center gap-2 justify-end mt-1">
                  <Thermometer size={20} className="text-emerald-400" />
                  <span className="text-2xl font-mono font-bold text-white">
                    {shipment.latestTemperature != null
                      ? `${shipment.latestTemperature.toFixed(1)}°C`
                      : "Telemetry Active"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Target Band: {shipment.tempMin}°C to {shipment.tempMax}°C
                </p>
              </div>
            </div>

            {/* Stepper Status Progress */}
            <div className="py-2">
              <p className="text-xs text-slate-400 font-semibold mb-4 uppercase tracking-wider">
                Consignment Status: <span className="text-emerald-400">{shipment.status}</span>
              </p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {[
                  { step: 1, label: "Booking", desc: "Dispatch Prepared" },
                  { step: 2, label: "Dispatched", desc: "Reefer Loaded" },
                  { step: 3, label: "In Transit", desc: "Cold Chain Verified" },
                  { step: 4, label: "Delivered", desc: "Signed Off" },
                ].map((s) => {
                  const currentStep = getStepProgress(shipment.status);
                  const isDone = currentStep >= s.step;
                  const isCurrent = currentStep === s.step;

                  return (
                    <div key={s.step} className="flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition-all ${
                          isDone
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                            : "bg-slate-700 text-slate-400"
                        } ${isCurrent ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-800" : ""}`}
                      >
                        {isDone ? <CheckCircle2 size={16} /> : s.step}
                      </div>
                      <span className={`font-semibold ${isDone ? "text-white" : "text-slate-500"}`}>
                        {s.label}
                      </span>
                      <span className="text-[10px] text-slate-400 hidden sm:block mt-0.5">
                        {s.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Corridor & Equipment Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-700/60 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Origin Logistics Point</span>
                <p className="text-white font-bold flex items-center gap-1.5">
                  <MapPin size={14} className="text-emerald-400 shrink-0" />
                  <span>{shipment.originName}</span>
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Destination Hub</span>
                <p className="text-white font-bold flex items-center gap-1.5">
                  <MapPin size={14} className="text-blue-400 shrink-0" />
                  <span>{shipment.destName}</span>
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Reefer Unit</span>
                <p className="text-white font-mono">
                  {shipment.assignedVehicle?.makeModel || "Certified Cold Reefer"} (
                  {shipment.assignedVehicle?.reeferType || "Standard Cooling"})
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Latest Timestamp</span>
                <p className="text-white font-mono">
                  {shipment.latestRecordedAt
                    ? new Date(shipment.latestRecordedAt).toLocaleString()
                    : new Date(shipment.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Informative Demonstration Footer */}
        <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl text-xs text-slate-400 text-center">
          <p>
            <strong>Public Provenance Security:</strong> Real-time temperature and status updates
            are streamed directly from authenticated edge sensors. Sensitive driver identity,
            hardware cryptographic tokens, and pricing data remain protected.
          </p>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Annapurna Rebuilt • Cold-Chain Integrity Platform</p>
      </footer>
    </div>
  );
}
