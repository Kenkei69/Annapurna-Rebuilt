"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Truck,
  Activity,
  AlertTriangle,
  LifeBuoy,
  Cpu,
  History,
  PlayCircle,
  Shield,
  LogOut,
  Menu,
  X,
  Building2,
  BarChart3,
  MapPin,
} from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organization?: {
      id: string;
      name: string;
      type: string;
    };
  } | null;
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = [
    { label: "Overview", href: "/dashboard", icon: Activity },
    { label: "Fleet Console", href: "/fleet", icon: MapPin },
    { label: "Shipments", href: "/shipments", icon: Truck },
    { label: "Alert Center", href: "/alerts", icon: AlertTriangle },
    { label: "Rescue Hub", href: "/rescue", icon: LifeBuoy },
    { label: "Analytics & ESG", href: "/analytics", icon: BarChart3 },
    { label: "Edge Devices", href: "/devices", icon: Cpu },
    { label: "Simulator", href: "/simulator", icon: PlayCircle, highlight: true },
    { label: "Audit Trail", href: "/audit", icon: History },
  ];

  if (user?.role === "ADMIN") {
    navItems.push({ label: "Administration", href: "/admin", icon: Shield, highlight: false });
  }

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Logout failed:", e);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold tracking-tight text-base">Annapurna</span>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
            Rebuilt
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:inset-auto ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              A
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-base tracking-tight">Annapurna</span>
                <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded">
                  Rebuilt
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Cold-Chain & Rescue</p>
            </div>
          </Link>
        </div>

        {/* Current Organization & User Badge */}
        {user && (
          <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-xs">
              <Building2 size={14} className="text-slate-400 shrink-0" />
              <div className="truncate">
                <p className="font-medium text-slate-200 truncate">
                  {user.organization?.name || "Independent"}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="capitalize">{user.role.toLowerCase()}</span>
                  <span>•</span>
                  <span className="truncate">{user.email}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-800 text-white shadow-xs font-semibold"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                } ${item.highlight ? "text-emerald-400 hover:text-emerald-300" : ""}`}
              >
                <Icon size={18} className={isActive ? "text-emerald-400" : item.highlight ? "text-emerald-400" : "text-slate-400"} />
                <span>{item.label}</span>
                {item.highlight && (
                  <span className="ml-auto text-[10px] bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.5 rounded font-mono">
                    LAB
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className="px-3 py-1.5 bg-slate-800/40 rounded border border-slate-700/50 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Isolation Boundary</span>
            <span className="text-emerald-400 font-medium">Tenant Safe</span>
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Operational Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Deterministic Cold-Chain Guardian
            </span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline text-slate-500">
              PostgreSQL Multi-Tenant Authoritative Record
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/simulator"
              className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded font-medium transition-colors"
            >
              <PlayCircle size={14} />
              <span>Simulate Incident</span>
            </Link>
            <Link
              href="/audit"
              className="text-slate-500 hover:text-slate-800 font-medium"
            >
              Audit Log
            </Link>
          </div>
        </div>

        {/* Content Container */}
        <div className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</div>
      </main>

      {/* Mobile Overlay backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/50 z-30 md:hidden"
        />
      )}
    </div>
  );
}
