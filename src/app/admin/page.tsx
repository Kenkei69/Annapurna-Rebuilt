import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Shield, Building2, Users, Cpu, Database, Activity, Lock } from "lucide-react";
import { UserRole } from "@prisma/client";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const orgs = await prisma.organization.findMany({
    include: {
      memberships: {
        include: { user: true },
      },
      vehicles: true,
      devices: true,
      shipments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalUsers = await prisma.user.count();
  const totalDevices = await prisma.device.count();
  const totalTelemetry = await prisma.telemetryReading.count();
  const totalAudit = await prisma.auditEvent.count();

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.memberships[0]?.organization,
      }}
    >
      <div className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold mb-2">
            <Lock size={12} />
            <span>Restricted Administrative Surface</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System &amp; Tenant Governance</h1>
          <p className="text-xs text-slate-500 mt-1">
            Global tenant boundaries, membership registries &amp; platform health telemetry
          </p>
        </div>

        {/* Platform Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Organizations"
            value={orgs.length}
            subtitle="Multi-tenant partitions"
            icon={<Building2 size={20} />}
          />
          <MetricCard
            title="Registered Users"
            value={totalUsers}
            subtitle="Across all roles"
            icon={<Users size={20} />}
          />
          <MetricCard
            title="Edge Sensors"
            value={totalDevices}
            subtitle="Provisioned IoT units"
            icon={<Cpu size={20} />}
          />
          <MetricCard
            title="Ingested Telemetry"
            value={totalTelemetry.toLocaleString()}
            subtitle="Sensor events processed"
            icon={<Activity size={20} />}
            variant="success"
          />
        </div>

        {/* Organizations & Tenant Membership Registry */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Tenant Organizations &amp; Boundary Allocation</h2>
            <span className="text-xs text-slate-400">{orgs.length} provisioned tenants</span>
          </div>

          <div className="divide-y divide-slate-100">
            {orgs.map((org) => (
              <div key={org.id} className="p-6 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-base">{org.name}</span>
                    <span className="text-xs text-slate-400 font-mono">({org.slug})</span>
                    <StatusBadge status={org.type} />
                  </div>
                  <span className="text-xs text-slate-400 font-mono">ID: {org.id}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Members</span>
                    <p className="font-bold text-slate-800 text-sm mt-0.5">{org.memberships.length}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Vehicles</span>
                    <p className="font-bold text-slate-800 text-sm mt-0.5">{org.vehicles.length}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">IoT Devices</span>
                    <p className="font-bold text-slate-800 text-sm mt-0.5">{org.devices.length}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Shipments</span>
                    <p className="font-bold text-slate-800 text-sm mt-0.5">{org.shipments.length}</p>
                  </div>
                </div>

                {/* Members List */}
                <div className="text-xs">
                  <span className="font-semibold text-slate-700">Organization Members:</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {org.memberships.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 text-[11px]"
                      >
                        <span className="font-medium">{m.user.name}</span>
                        <span className="text-slate-400">({m.user.email})</span>
                        <span className="font-mono text-[10px] text-emerald-700 font-bold">[{m.orgRole}]</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
