import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { AnalyticsClient, AnalyticsData } from "./AnalyticsClient";

export const metadata = {
  title: "Analytics & Compliance — Annapurna Rebuilt",
  description: "Tenant-scoped cold-chain analytics, thermal breach distribution, and statutory standards.",
};

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = user.memberships[0]?.organizationId;
  const whereOrg = user.role === "ADMIN" ? {} : { organizationId: orgId };

  // 1. Query real shipment counts
  const totalShipments = await prisma.shipment.count({ where: whereOrg });
  const deliveredShipments = await prisma.shipment.count({
    where: { ...whereOrg, status: "DELIVERED" },
  });
  const alertedShipments = await prisma.shipment.count({
    where: { ...whereOrg, status: { in: ["ALERTED", "RESCUE_PENDING"] } },
  });
  const activeShipments = await prisma.shipment.count({
    where: { ...whereOrg, status: { in: ["DISPATCHED", "IN_TRANSIT"] } },
  });

  // 2. Query alerts by severity
  const totalAlerts = await prisma.alert.count({ where: whereOrg });
  const criticalAlerts = await prisma.alert.count({
    where: { ...whereOrg, severity: "CRITICAL" },
  });
  const highAlerts = await prisma.alert.count({
    where: { ...whereOrg, severity: "HIGH" },
  });
  const mediumAlerts = await prisma.alert.count({
    where: { ...whereOrg, severity: "MEDIUM" },
  });
  const lowAlerts = await prisma.alert.count({
    where: { ...whereOrg, severity: "LOW" },
  });

  // 3. Query rescue opportunities
  const totalRescues = await prisma.rescueOpportunity.count({ where: whereOrg });
  const completedRescues = await prisma.rescueOpportunity.count({
    where: { ...whereOrg, status: "COMPLETED" },
  });

  // 4. Query accepted offer amounts
  const acceptedOffers = await prisma.rescueOffer.findMany({
    where: {
      status: "ACCEPTED",
      ...(user.role === "ADMIN"
        ? {}
        : {
            opportunity: { organizationId: orgId },
          }),
    },
    select: { offerAmount: true },
  });

  const recoveredRescueValue = acceptedOffers.reduce((sum, o) => sum + o.offerAmount, 0);

  // 5. Query recent audit events
  const recentAuditEvents = await prisma.auditEvent.findMany({
    where: whereOrg,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      entityType: true,
      createdAt: true,
      detailsJson: true,
    },
  });

  const analyticsData: AnalyticsData = {
    totalShipments,
    deliveredShipments,
    alertedShipments,
    activeShipments,
    totalAlerts,
    alertsBySeverity: {
      LOW: lowAlerts,
      MEDIUM: mediumAlerts,
      HIGH: highAlerts,
      CRITICAL: criticalAlerts,
    },
    totalRescues,
    completedRescues,
    totalValueMonitored: totalShipments * 150000, // Nominal estimation based on average reefer load
    recoveredRescueValue,
    estimatedFoodSavedKg: completedRescues * 3500 + deliveredShipments * 4000,
    recentAuditEvents: recentAuditEvents.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      createdAt: a.createdAt,
      detailsJson: a.detailsJson || "{}",
    })),
  };

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
      <AnalyticsClient
        data={analyticsData}
        organizationName={user.memberships[0]?.organization?.name}
      />
    </AppShell>
  );
}
