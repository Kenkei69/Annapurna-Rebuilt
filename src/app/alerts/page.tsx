import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { AlertsClient } from "./AlertsClient";

export default async function AlertsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = user.memberships[0]?.organizationId;

  const alerts = await prisma.alert.findMany({
    where: user.role === "ADMIN" ? {} : { organizationId: orgId },
    select: {
      id: true,
      shipmentId: true,
      ruleCode: true,
      severity: true,
      status: true,
      summary: true,
      createdAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      ackNotes: true,
      resolutionNotes: true,
      // Safe actor projections: NO passwordHash
      acknowledgedBy: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
      shipment: {
        select: {
          id: true,
          trackingNumber: true,
          title: true,
          cargoType: true,
          tempMin: true,
          tempMax: true,
          latestTemperature: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

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
      <AlertsClient
        alerts={alerts.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
          resolvedAt: a.resolvedAt?.toISOString() ?? null,
        }))}
        userRole={user.role}
      />
    </AppShell>
  );
}
