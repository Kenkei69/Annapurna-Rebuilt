import React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  LifeBuoy,
  Brain,
  Building2,
  Truck,
  ArrowRight,
  CheckCircle2,
  ThermometerSnowflake,
} from "lucide-react";

export const metadata = {
  title: "Platform Capabilities & Architecture — Annapurna Rebuilt",
  description: "End-to-end cold-chain operational safeguards and autonomous cargo rescue capabilities.",
};

export default function FeaturesPage() {
  const capabilities = [
    {
      icon: <ThermometerSnowflake className="w-6 h-6 text-emerald-500" />,
      badge: "Edge Ingestion",
      title: "Authenticated IoT Telemetry",
      description:
        "Field hardware authenticates with deterministic SHA-256 tokens. The pipeline enforces clock drift verification (±10m), strictly monotonic sequences, and duplicate packet suppression.",
      highlights: [
        "Rejects future-drifted packets (>10m)",
        "Sequence deduplication in atomic transactions",
        "Simulator isolation keeps test traffic separated",
      ],
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-amber-500" />,
      badge: "Anomaly Engine",
      title: "Deterministic Alerting & Hysteresis",
      description:
        "Cold-chain monitoring evaluates cargo-specific temperature bands, sub-cooling incidents, and sustained compressor breach thresholds with explicit hysteresis margins.",
      highlights: [
        "0.5°C hysteresis margin prevents alert flapping",
        "Sustained breach escalation to CRITICAL severity",
        "Missing-heartbeat scans independently of incoming packets",
      ],
    },
    {
      icon: <LifeBuoy className="w-6 h-6 text-blue-500" />,
      badge: "Marketplace Core",
      title: "ACID Single-Winner Cargo Rescue",
      description:
        "When reefer units fail, distressed shipments broadcast rescue requests. Nearby certified cold storage facilities submit counter-proposals with atomic single-winner acceptance.",
      highlights: [
        "PostgreSQL row-level locks prevent double-acceptance races",
        "Certified partner qualification and capacity vetting",
        "Immutable milestone logging (Handoff → Storage → Delivery)",
      ],
    },
    {
      icon: <Building2 className="w-6 h-6 text-purple-500" />,
      badge: "Multi-Tenancy",
      title: "Fail-Closed Tenant Isolation",
      description:
        "Strict database policies guarantee that Organization B cannot view or mutate Organization A's shipments, devices, alerts, or offers. Competitor data is fully redacted.",
      highlights: [
        "Tenant-scoped API queries with database-verified roles",
        "Zero credential hash exposure in client DTO projections",
        "Audited administrative actions in append-only ledger",
      ],
    },
    {
      icon: <Truck className="w-6 h-6 text-cyan-500" />,
      badge: "Field Operations",
      title: "Driver Workspace & Delivery Logging",
      description:
        "Mobile-first workspace for reefer drivers. Displays real-time assigned route corridors, live thermal bounds, immediate incident alerts, and delivery completion logging.",
      highlights: [
        "Scoped to driver's assigned shipments only",
        "Clear non-blocking visual alerts and feedback",
        "Accessible contrast and keyboard navigation",
      ],
    },
    {
      icon: <Brain className="w-6 h-6 text-rose-500" />,
      badge: "Advisory AI",
      title: "Human-in-the-Loop AI Assistant",
      description:
        "Calculates thermal warming gradients, spoilage risk curves, and recommended transfer depots. AI suggestions remain advisory; final operational authorizations require verified operator sign-off.",
      highlights: [
        "Explicit uncertainty disclosure and source citations",
        "Deterministic expert system fallback when AI provider is offline",
        "No autonomous SQL generation or uncontrolled commits",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-base">
              A
            </div>
            <span className="font-bold text-base text-white tracking-tight">
              Annapurna <span className="text-emerald-400">Rebuilt</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              Overview
            </Link>
            <Link href="/architecture" className="text-slate-400 hover:text-white transition-colors">
              Architecture
            </Link>
            <Link href="/tracking" className="text-slate-400 hover:text-white transition-colors">
              Public Tracking
            </Link>
            <Link href="/bidding" className="text-slate-400 hover:text-white transition-colors">
              Bidding Hub
            </Link>
            <Link
              href="/login"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 text-xs font-semibold">
          <span>Enterprise Cold-Chain Safeguards</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Engineered for <span className="text-emerald-400">Zero Spoilage</span> &amp; Absolute Integrity
        </h1>
        <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
          Annapurna Rebuilt replaces brittle simulation assumptions with authoritative PostgreSQL
          state, deterministic telemetry verification, and transaction-safe emergency liquidations.
        </p>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {capabilities.map((c, i) => (
          <div
            key={i}
            className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-lg flex flex-col justify-between hover:border-slate-600 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">{c.icon}</div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                  {c.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{c.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{c.description}</p>
            </div>

            <ul className="mt-6 pt-4 border-t border-slate-700/60 space-y-2 text-xs text-slate-300">
              {c.highlights.map((h, hi) => (
                <li key={hi} className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center space-y-6">
        <h2 className="text-2xl font-bold text-white">Ready to experience Annapurna Rebuilt?</h2>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold text-sm shadow-lg transition-colors"
          >
            <span>Access Workspace</span>
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/fleet"
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            <Truck size={16} className="text-emerald-400" />
            <span>Launch Fleet Console</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 py-8 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Annapurna Rebuilt • Clean Architecture & Verification</p>
      </footer>
    </div>
  );
}
