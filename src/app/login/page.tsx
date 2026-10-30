"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
      setLoading(false);
    }
  };

  const setPersona = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-xl shadow-xs">
            A
          </div>
          <span className="font-bold text-2xl text-slate-900 tracking-tight">Annapurna</span>
          <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
            Rebuilt
          </span>
        </Link>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sign in to your workspace</h2>
        <p className="mt-1 text-xs text-slate-500">
          Cold-Chain Ingestion, Thermal Telemetry &amp; Cargo Rescue Hub
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@transcold.com"
                  className="w-full px-3 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
                <Mail size={16} className="absolute left-3 top-2.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
                <Lock size={16} className="absolute left-3 top-2.5 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-sm transition-all shadow-xs disabled:opacity-50"
            >
              <span>{loading ? "Authenticating..." : "Sign In to Platform"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>One-Click Demo Personas</span>
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPersona("operator@transcold.com", "Operator123!")}
                className="text-left p-2 rounded border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
              >
                <div className="font-semibold text-slate-800">Fleet Operator</div>
                <div className="text-[10px] text-slate-500 truncate">TransCold Express</div>
              </button>

              <button
                type="button"
                onClick={() => setPersona("director@sahyadricold.com", "Partner123!")}
                className="text-left p-2 rounded border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
              >
                <div className="font-semibold text-slate-800">Rescue Partner</div>
                <div className="text-[10px] text-slate-500 truncate">Sahyadri Hub</div>
              </button>

              <button
                type="button"
                onClick={() => setPersona("driver.raj@transcold.com", "Driver123!")}
                className="text-left p-2 rounded border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
              >
                <div className="font-semibold text-slate-800">Reefer Driver</div>
                <div className="text-[10px] text-slate-500 truncate">Assigned Route</div>
              </button>

              <button
                type="button"
                onClick={() => setPersona("admin@annapurna.local", "AdminPass123!")}
                className="text-left p-2 rounded border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
              >
                <div className="font-semibold text-slate-800">Admin</div>
                <div className="text-[10px] text-slate-500 truncate">Platform Health</div>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-slate-500">
          <span>Need to onboard a new company? </span>
          <Link href="/register" className="font-semibold text-emerald-700 hover:underline">
            Register Organization
          </Link>
        </div>
      </div>
    </div>
  );
}
