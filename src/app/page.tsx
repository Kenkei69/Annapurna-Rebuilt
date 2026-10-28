import Link from "next/link";
import {
  ThermometerSnowflake,
  ShieldAlert,
  LifeBuoy,
  Cpu,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";

export default function HomePage() {
  const demoUsers = [
    {
      role: "Fleet Operator",
      email: "operator@transcold.com",
      pass: "Operator123!",
      org: "TransCold Express Logistics",
      desc: "Manages reefer fleet, creates shipments, monitors temperature breaches, and accepts rescue offers.",
    },
    {
      role: "Reefer Driver",
      email: "driver.raj@transcold.com",
      pass: "Driver123!",
      org: "TransCold Express Logistics",
      desc: "Accesses assigned active cargo route, views alerts and operational instructions.",
    },
    {
      role: "Rescue Partner",
      email: "director@sahyadricold.com",
      pass: "Partner123!",
      org: "Sahyadri Cold Storage & Logistics Hub",
      desc: "Offers cold-storage and emergency reefer capacity for distressed cargo incidents.",
    },
    {
      role: "Platform Admin",
      email: "admin@annapurna.local",
      pass: "AdminPass123!",
      org: "System Operations",
      desc: "Restricted administrative tools, cross-tenant audit monitoring, and organization management.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-xl">
              A
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">Annapurna</span>
              <span className="ml-2 text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
                Rebuilt
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/login"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
            >
              Register Fleet
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-slate-900 text-white pt-16 pb-24 border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Original Implementation • Fresh Architecture & Codebase
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Cold-Chain Integrity &amp;{" "}
            <span className="text-emerald-400">Cargo-Rescue</span> Platform
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Protect high-value perishable goods in transit. Ingest authenticated IoT telemetry,
            detect thermal violations through deterministic alert rules, and coordinate
            transaction-safe cargo rescue transfers before spoilage occurs.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all"
            >
              <span>Access Operational Workspace</span>
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-6 py-3 rounded-lg font-semibold transition-all"
            >
              <Cpu size={18} className="text-emerald-400" />
              <span>Launch Telemetry Simulator</span>
            </Link>
          </div>

          {/* Core Technical Tenets */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left border-t border-slate-800 pt-8 text-xs text-slate-400">
            <div>
              <p className="font-bold text-slate-200">PostgreSQL Authoritative</p>
              <p className="mt-0.5">ACID transactions, row constraints &amp; audit logging</p>
            </div>
            <div>
              <p className="font-bold text-slate-200">Strict Tenant Isolation</p>
              <p className="mt-0.5">Explicit organization boundary verification</p>
            </div>
            <div>
              <p className="font-bold text-slate-200">Deterministic Alerting</p>
              <p className="mt-0.5">Hysteresis, deduplication &amp; sustained breach logic</p>
            </div>
            <div>
              <p className="font-bold text-slate-200">AI Human-in-the-Loop</p>
              <p className="mt-0.5">Advisory gradient calculations; no autonomous dispatch</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="py-16 max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Complete Cold-Chain Operational Lifecycle
          </h2>
          <p className="text-slate-600 text-sm mt-2 max-w-xl mx-auto">
            From edge device telemetry ingestion to multi-partner cargo rescue settlements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Pillar 1 */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                <ThermometerSnowflake size={26} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">1. Real-Time Telemetry &amp; Ingestion</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Edge devices authenticate with per-device SHA-256 API tokens. Telemetry payloads validate
                sequence deduplication, future clock drift bounds, and out-of-order readings.
              </p>
            </div>
            <ul className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Deterministic replay protection</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Clear simulated vs hardware tagging</span>
              </li>
            </ul>
          </div>

          {/* Pillar 2 */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
                <ShieldAlert size={26} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">2. Transparent Anomaly Alerts</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Configurable per-cargo thresholds evaluate high breach, low sub-cooling, and sustained
                compressor failures. Complete operator acknowledgment and resolution lifecycle.
              </p>
            </div>
            <ul className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Alert storm suppression &amp; hysteresis</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Operator acknowledgment audit trails</span>
              </li>
            </ul>
          </div>

          {/* Pillar 3 */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
                <LifeBuoy size={26} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">3. Transaction-Safe Cargo Rescue</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                When reefer units fail, operators broadcast rescue opportunities. Certified cold storage
                partners submit offers. Acceptance is ACID transaction-safe with single-winner enforcement.
              </p>
            </div>
            <ul className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Zero double-acceptance race conditions</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>End-to-end transfer milestone log</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Demo Credentials Sandbox Section */}
      <section className="bg-slate-100 py-16 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Live Verification Access
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                Pre-Provisioned Demo Personas
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Experience Annapurna Rebuilt through the exact perspective of each stakeholder role.
              </p>
            </div>
            <Link
              href="/login"
              className="mt-4 sm:mt-0 text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>Go to Sign In</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {demoUsers.map((u) => (
              <div
                key={u.email}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {u.role}
                    </span>
                    <Lock size={12} className="text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-2">{u.org}</p>
                  <p className="text-xs text-slate-600 mt-2 leading-normal">{u.desc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 font-mono text-[11px] space-y-1">
                  <div className="text-slate-700 truncate select-all">{u.email}</div>
                  <div className="text-slate-500 font-sans text-xs">
                    Password: <span className="font-mono text-slate-800 font-semibold">{u.pass}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-slate-900 text-slate-400 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-slate-300 font-semibold">Annapurna Rebuilt</p>
            <p className="mt-1">
              Developed by <span className="text-white font-medium">Kenkei69</span> with AI assistance.
            </p>
          </div>
          <div className="flex items-center gap-6 text-slate-400">
            <Link href="/login" className="hover:text-white">
              Sign In
            </Link>
            <Link href="/simulator" className="hover:text-white">
              Simulator
            </Link>
            <span>Clean Provenance &amp; Multi-Tenant Isolation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
