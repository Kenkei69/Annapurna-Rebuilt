import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Truck,
  AlertTriangle,
  LifeBuoy,
  Cpu,
  ArrowRight,
  PlusCircle,
  PlayCircle,
  Thermometer,
  Building2,
} from "lucide-react";
import { AlertStatus, ShipmentStatus } from "@prisma/client";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const primaryMembership = user.memberships[0];
  const orgId = primaryMembership?.organizationId;

  // Handle users without organization context
  if (!primaryMembership && user.role !== "ADMIN") {
    return (
      <AppShell
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: undefined,
        }}
      >
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-lg mx-auto mt-12 shadow-xs">
          <Building2 size={40} className="text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">No Organization Association</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Your user account is not currently linked to an active fleet or rescue organization.
            Please contact your organization administrator to receive an invitation or register a new organization.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/register"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 transition-colors"
            >
              Register Organization
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const isRescuePartner = primaryMembership?.organization?.type === "RESCUE_PARTNER";

  // If partner, fetch partner-specific stats
  if (isRescuePartner && orgId) {
    const opportunities = await prisma.rescueOpportunity.findMany({
      where: {
        status: { in: ["OPEN", "OFFERED", "ACCEPTED", "IN_PROGRESS"] },
      },
      include: {
        organization: { select: { id: true, name: true, slug: true, type: true } },
        offers: {
          where: { partnerOrgId: orgId },
          select: { id: true, status: true, offerAmount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const partnerProfile = await prisma.rescuePartnerProfile.findUnique({
      where: { organizationId: orgId },
      select: { isActive: true, onboardingComplete: true, verificationStatus: true },
    });

    const myOffersCount = await prisma.rescueOffer.count({
      where: { partnerOrgId: orgId },
    });

    return (
      <AppShell
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: primaryMembership?.organization,
        }}
      >
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rescue Partner Hub</h1>
              <p className="text-xs text-slate-500 mt-1">
                Active opportunities for cold storage and emergency cargo offloading
              </p>
            </div>
            <Link
              href="/rescue"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 shadow-xs transition-colors"
            >
              <LifeBuoy size={16} />
              <span>Browse All Rescue Opportunities</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              title="Active Opportunities"
              value={opportunities.length}
              subtitle="Cargo incidents requesting partner intervention"
              icon={<LifeBuoy size={20} />}
              variant={opportunities.length > 0 ? "warning" : "default"}
            />
            <MetricCard
              title="Submitted Offers"
              value={myOffersCount}
              subtitle="Total proposals filed by your facility"
              icon={<Truck size={20} />}
            />
            <MetricCard
              title="Partner Facility"
              value={partnerProfile?.isActive ? "Active" : "Inactive"}
              subtitle={partnerProfile?.onboardingComplete ? "Onboarding complete · Self-reported" : "Onboarding incomplete"}
              icon={<Cpu size={20} />}
              variant={partnerProfile?.isActive ? "success" : "warning"}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Incident Marketplace (Real-Time Requests)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distressed reefer shipments broadcasting emergency offload capacity requests
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {opportunities.length} open operations
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {opportunities.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No active cargo rescue operations broadcasting currently.
                </div>
              ) : (
                opportunities.map((opp) => (
                  <div key={opp.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={opp.status} />
                        <span className="text-xs text-slate-400 font-mono">From: {opp.organization.name}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">{opp.title}</h3>
                      <p className="text-xs text-slate-600 mt-1">{opp.cargoDescription} • {opp.cargoWeightKg.toLocaleString()} kg</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Required Temperature: {opp.tempRequirementMin}°C to {opp.tempRequirementMax}°C
                      </p>
                    </div>

                    <Link
                      href={`/rescue?opportunityId=${opp.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors"
                    >
                      <span>Submit Capacity Offer</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // Fleet Operator / Admin Dashboard
  const tenantWhere = user.role === "ADMIN" ? {} : { organizationId: orgId ?? "FAIL_CLOSED" };

  const shipments = await prisma.shipment.findMany({
    where: tenantWhere,
    select: {
      id: true,
      trackingNumber: true,
      title: true,
      cargoType: true,
      tempMin: true,
      tempMax: true,
      destName: true,
      originName: true,
      status: true,
      latestTemperature: true,
      assignedVehicle: {
        select: { id: true, licensePlate: true, makeModel: true },
      },
      assignedDevice: {
        select: { id: true, deviceIdentifier: true, hardwareModel: true, status: true },
      },
      alerts: {
        where: { status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] } },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const totalShipments = await prisma.shipment.count({
    where: tenantWhere,
  });

  const inTransitCount = await prisma.shipment.count({
    where: {
      ...tenantWhere,
      status: ShipmentStatus.IN_TRANSIT,
    },
  });

  const activeAlerts = await prisma.alert.findMany({
    where: {
      ...tenantWhere,
      status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
    },
    select: {
      id: true,
      shipmentId: true,
      ruleCode: true,
      severity: true,
      summary: true,
      shipment: {
        select: { trackingNumber: true, cargoType: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const openRescues = await prisma.rescueOpportunity.count({
    where: {
      ...tenantWhere,
      status: { in: ["OPEN", "OFFERED", "ACCEPTED", "IN_PROGRESS"] },
    },
  });

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: primaryMembership?.organization,
      }}
    >
      <div className="space-y-6">
        {/* Welcome & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fleet Operational Control</h1>
            <p className="text-xs text-slate-500 mt-1">
              Active telemetry monitoring, cold-chain threshold compliance &amp; incident dispatch
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors border border-slate-300"
            >
              <PlayCircle size={16} className="text-emerald-700" />
              <span>Simulate Incident</span>
            </Link>

            <Link
              href="/shipments"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <PlusCircle size={16} />
              <span>New Shipment</span>
            </Link>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Shipments"
            value={totalShipments}
            subtitle={`${inTransitCount} currently in active transit`}
            icon={<Truck size={20} />}
          />
          <MetricCard
            title="Active In Transit"
            value={inTransitCount}
            subtitle="Live reefer tracking"
            icon={<Thermometer size={20} />}
            variant="success"
          />
          <MetricCard
            title="Thermal Alerts"
            value={activeAlerts.length}
            subtitle={activeAlerts.length > 0 ? "Requires operator action" : "All routes safe"}
            icon={<AlertTriangle size={20} />}
            variant={activeAlerts.length > 0 ? "danger" : "default"}
          />
          <MetricCard
            title="Rescue Requests"
            value={openRescues}
            subtitle="Cargo rescue operations"
            icon={<LifeBuoy size={20} />}
            variant={openRescues > 0 ? "warning" : "default"}
          />
        </div>

        {/* Active Alerts Banner if alerts exist */}
        {activeAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                <AlertTriangle size={18} className="text-red-600 shrink-0" />
                <span>Active Thermal Incident Alerts ({activeAlerts.length})</span>
              </div>
              <Link href="/alerts" className="text-xs font-semibold text-red-700 hover:text-red-900">
                View Alert Center &rarr;
              </Link>
            </div>

            <div className="space-y-2">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-white p-3 rounded-lg border border-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={alert.severity} />
                      <span className="font-semibold text-slate-800">{alert.ruleCode}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600 font-mono">
                        {alert.shipment.trackingNumber} ({alert.shipment.cargoType})
                      </span>
                    </div>
                    <p className="text-slate-700 mt-1">{alert.summary}</p>
                  </div>

                  <Link
                    href={`/shipments/${alert.shipmentId}`}
                    className="inline-flex items-center gap-1 text-red-700 hover:text-red-900 font-semibold shrink-0"
                  >
                    <span>Inspect Incident</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shipments Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Active Cargo Fleet Tracking</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative cold-chain status from authenticated edge devices
              </p>
            </div>
            <Link
              href="/shipments"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>View All Shipments</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Tracking / Cargo</th>
                  <th className="px-6 py-3">Route</th>
                  <th className="px-6 py-3">Vehicle &amp; Device</th>
                  <th className="px-6 py-3 text-right">Latest Temp</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      No shipments found for this fleet. Create a new shipment to begin telemetry tracking.
                    </td>
                  </tr>
                ) : (
                  shipments.map((s) => {
                    const isBreach =
                      s.latestTemperature != null &&
                      (s.latestTemperature > s.tempMax || s.latestTemperature < s.tempMin);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <Link
                            href={`/shipments/${s.id}`}
                            className="font-bold text-slate-900 hover:text-emerald-600 transition-colors font-mono"
                          >
                            {s.trackingNumber}
                          </Link>
                          <div className="text-slate-500 text-[11px] mt-0.5">{s.title}</div>
                          <div className="text-slate-400 text-[10px]">{s.cargoType}</div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-slate-800 font-medium">{s.destName}</div>
                          <div className="text-slate-400 text-[10px]">From: {s.originName}</div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-mono text-slate-800">
                            {s.assignedVehicle?.licensePlate || "Unassigned"}
                          </div>
                          <div className="text-slate-400 text-[10px] font-mono">
                            {s.assignedDevice?.deviceIdentifier || "No IoT Device"}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          {s.latestTemperature != null ? (
                            <div>
                              <span
                                className={`inline-block font-mono font-bold text-sm px-2 py-0.5 rounded ${
                                  isBreach
                                    ? "bg-red-100 text-red-800 border border-red-200"
                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                }`}
                              >
                                {s.latestTemperature.toFixed(1)}°C
                              </span>
                              <div className="text-[10px] text-slate-400 mt-1">
                                Safe: {s.tempMin}° to {s.tempMax}°C
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No telemetry</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <StatusBadge status={s.status} />
                          {s.alerts.length > 0 && (
                            <div className="text-[10px] text-red-600 font-semibold mt-1">
                              {s.alerts.length} active alert{s.alerts.length > 1 ? "s" : ""}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/shipments/${s.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium text-xs transition-colors"
                          >
                            <span>Inspect</span>
                            <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
