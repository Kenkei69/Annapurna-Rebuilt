import React from "react";
import Link from "next/link";
import {
  LifeBuoy,
  ShieldCheck,
  ArrowRight,
  Clock,
  Zap,
} from "lucide-react";

export const metadata = {
  title: "Rescue Marketplace & Bidding Hub — Annapurna Rebuilt",
  description: "Certified cold storage partner bidding, emergency cargo offloading, and milestone tracking.",
};

export default function BiddingHubPage() {
  const sampleListings = [
    {
      id: "EMERGENCY-CARGO-401",
      cargo: "Grade-A Export Strawberries",
      quantity: "4,200 kg",
      askingPrice: "₹45 / kg",
      totalValue: "₹1,89,000",
      originCorridor: "Mahabaleshwar → Mumbai Air Cargo",
      currentTemp: "8.5°C (Safe Max: 4.0°C)",
      urgency: "HIGH",
      timeRemaining: "1h 45m before spoilage",
      bids: [
        {
          partner: "Sahyadri Cold Storage & Hub",
          type: "COLD_STORAGE",
          offeredPrice: "₹40 / kg",
          total: "₹1,68,000",
          capacity: "10,000 kg available",
          status: "ACCEPTED",
        },
        {
          partner: "Kisan Agro Logistics Center",
          type: "WHOLESALE_BUYER",
          offeredPrice: "₹36 / kg",
          total: "₹1,51,200",
          capacity: "5,000 kg available",
          status: "REJECTED",
        },
      ],
    },
    {
      id: "EMERGENCY-CARGO-402",
      cargo: "Pasteurized Milk Crates",
      quantity: "6,000 Litres",
      askingPrice: "₹32 / L",
      totalValue: "₹1,92,000",
      originCorridor: "Sangli Dairy Hub → Pune Hub",
      currentTemp: "9.2°C (Safe Max: 5.0°C)",
      urgency: "CRITICAL",
      timeRemaining: "45m before bacterial breach",
      bids: [
        {
          partner: "Western Ghats Cold Chain",
          type: "EMERGENCY_REEFER",
          offeredPrice: "₹29 / L",
          total: "₹1,74,000",
          capacity: "8,000 L available",
          status: "SUBMITTED",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-base">
              A
            </div>
            <span className="font-bold text-base text-white tracking-tight">
              Annapurna <span className="text-emerald-400">Rescue Marketplace</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              Overview
            </Link>
            <Link href="/features" className="text-slate-400 hover:text-white transition-colors">
              Features
            </Link>
            <Link href="/architecture" className="text-slate-400 hover:text-white transition-colors">
              Architecture
            </Link>
            <Link href="/tracking" className="text-slate-400 hover:text-white transition-colors">
              Tracking
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
      <main className="max-w-7xl mx-auto px-6 py-12 w-full space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 text-xs font-semibold">
            <LifeBuoy size={14} />
            <span>Autonomous Distress Liquidation</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Cold-Chain Cargo Rescue Marketplace
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            When refrigerated transport fails, spoilage is a matter of hours. Annapurna Rebuilt
            connects distressed consignments with verified regional cold storage facilities and
            wholesale buyers through single-winner, transaction-safe bidding.
          </p>
        </div>

        {/* Core Guarantees 3-Column */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-white text-base">Certified Partner Vetting</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every participating cold storage warehouse and emergency reefer fleet must complete
              onboarding verification, documenting valid capacity and temperature capabilities before
              placing bids.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Zap size={20} />
            </div>
            <h3 className="font-bold text-white text-base">Single-Winner Concurrency</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              PostgreSQL row-level locks guarantee mutual exclusion. When multiple facilities submit
              competing offers, exactly one accepted winner is persisted. Subsequent attempts fail
              gracefully.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <h3 className="font-bold text-white text-base">Audited Transfer Milestones</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every step from driver reroute dispatch to dock arrival, physical pallet offloading,
              and warehouse receiver sign-off is logged immutably in the PostgreSQL audit ledger.
            </p>
          </div>
        </div>

        {/* Live Marketplace Simulation Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-white">Active Distress Opportunities (Demonstration)</h2>
              <p className="text-xs text-slate-400">
                Sample operational rescue listings demonstrating real-time bids, capacity checks, and accepted awards.
              </p>
            </div>
            <Link
              href="/rescue"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
            >
              <span>Access Operator Rescue Hub</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sampleListings.map((listing) => (
              <div
                key={listing.id}
                className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-lg space-y-4"
              >
                <div className="flex items-start justify-between border-b border-slate-700 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      {listing.id}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1.5">{listing.cargo}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{listing.originCorridor}</p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      listing.urgency === "CRITICAL"
                        ? "bg-red-900/60 text-red-300 border border-red-700"
                        : "bg-amber-900/60 text-amber-300 border border-amber-700"
                    }`}
                  >
                    {listing.urgency}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 text-center text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Quantity</span>
                    <span className="font-mono font-bold text-white">{listing.quantity}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Core Temp</span>
                    <span className="font-mono font-bold text-red-400">{listing.currentTemp}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Asking Total</span>
                    <span className="font-mono font-bold text-emerald-400">{listing.totalValue}</span>
                  </div>
                </div>

                {/* Bids received */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Certified Partner Offers ({listing.bids.length})
                  </span>
                  {listing.bids.map((b, bi) => (
                    <div
                      key={bi}
                      className="bg-slate-900/40 border border-slate-700/70 rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{b.partner}</span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {b.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                          Bid: <strong>{b.offeredPrice}</strong> • Total: {b.total} • {b.capacity}
                        </p>
                      </div>

                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          b.status === "ACCEPTED"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : b.status === "REJECTED"
                            ? "bg-slate-800 text-slate-500"
                            : "bg-blue-950 text-blue-400 border border-blue-800"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Onboarding Call to Action */}
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-8 text-center space-y-4">
          <h3 className="text-2xl font-bold text-white">Are you a Cold Storage or Wholesale Operator?</h3>
          <p className="text-xs text-slate-300 max-w-xl mx-auto leading-relaxed">
            Join the Annapurna Rescue Network to absorb distressed shipments, monetize excess facility
            capacity, and protect food supply chains from catastrophic landfill waste.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/register"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs transition-colors shadow-md"
            >
              Register Facility as Rescue Partner
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 py-8 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Annapurna Rebuilt • Certified Cargo Liquidation</p>
      </footer>
    </div>
  );
}
