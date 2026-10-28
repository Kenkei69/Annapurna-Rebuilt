"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Thermometer,
  Truck,
  AlertTriangle,
  LifeBuoy,
  Cpu,
  Activity,
  History,
  LogOut,
  Menu,
  X,
} from "lucide-react";

interface UserSession {
  id: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string | null;
  organizationName?: string | null;
}

export function AppNavbar({ user }: { user?: UserSession | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Activity },
    { href: "/shipments", label: "Shipments", icon: Truck },
    { href: "/alerts", label: "Alerts", icon: AlertTriangle },
    { href: "/rescue", label: "Rescue Portal", icon: LifeBuoy },
    { href: "/devices", label: "Edge Devices", icon: Cpu },
    { href: "/simulator", label: "Simulator", icon: Activity },
    { href: "/audit", label: "Audit Log", icon: History },
  ];

  const roleBadgeColors: Record<string, string> = {
    ADMIN: "bg-purple-900/60 text-purple-300 border-purple-700",
    FLEET_OPERATOR: "bg-blue-900/60 text-blue-300 border-blue-700",
    DRIVER: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    RESCUE_PARTNER: "bg-amber-900/60 text-amber-300 border-amber-700",
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Thermometer className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                  Annapurna
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-cyan-300 border border-cyan-500/30">
                    Rebuilt
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 -mt-1 tracking-wider uppercase">
                  Cold-Chain & Rescue
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            {user && (
              <div className="hidden md:flex items-center space-x-1 ml-6">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-slate-800 text-cyan-400 font-semibold"
                          : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Section: User & Auth */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="flex flex-col text-right">
                  <span className="text-sm font-semibold text-white">
                    {user.fullName || user.email.split("@")[0]}
                  </span>
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className={`text-[11px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                        roleBadgeColors[user.role] || "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {user.role.replace("_", " ")}
                    </span>
                    {user.organizationName && (
                      <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                        {user.organizationName}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  title="Sign Out"
                  className="p-2 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md shadow transition-colors"
                >
                  Register Fleet
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 space-y-1">
          {user ? (
            <>
              <div className="py-2 mb-2 border-b border-slate-800">
                <div className="text-sm font-semibold text-white">{user.fullName || user.email}</div>
                <div className="text-xs text-slate-400">{user.role} &bull; {user.organizationName || "Independent"}</div>
              </div>
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                      isActive ? "bg-slate-800 text-cyan-400" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center space-x-2 px-3 py-2 mt-2 rounded-md text-sm text-rose-400 hover:bg-slate-800"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div className="pt-2 space-y-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-md"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2 text-sm font-medium bg-blue-600 text-white rounded-md"
              >
                Register Fleet
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
