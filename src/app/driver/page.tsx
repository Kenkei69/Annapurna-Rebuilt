import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { DriverWorkspaceClient } from "./DriverWorkspaceClient";
import { UserRole } from "@prisma/client";

export default async function DriverWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Non-driver users should go to their appropriate home
  if (user.role !== UserRole.DRIVER && user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const primaryMembership = user.memberships[0];
  const orgId = primaryMembership?.organizationId;

  // Drivers see only their assigned shipments
  const shipments = await prisma.shipment.findMany({
    where: orgId
      ? { assignedDriverId: user.id, organizationId: orgId }
      : { id: "FAIL_CLOSED_NO_ACCESS" },
    select: {
      id: true,
      trackingNumber: true,
      title: true,
      cargoType: true,
      tempMin: true,
      tempMax: true,
      humidityMin: true,
      humidityMax: true,
      status: true,
      originName: true,
      destName: true,
      latestTemperature: true,
      latestHumidity: true,
      latestLat: true,
      latestLng: true,
      latestRecordedAt: true,
      createdAt: true,
      updatedAt: true,
      assignedVehicle: {
        select: { id: true, licensePlate: true, makeModel: true, reeferType: true, status: true },
      },
      assignedDevice: {
        select: { id: true, deviceIdentifier: true, hardwareModel: true, status: true, lastSeenAt: true },
      },
      alerts: {
        where: { status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
        select: {
          id: true,
          ruleCode: true,
          severity: true,
          status: true,
          summary: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      rescueOpportunity: {
        select: {
          id: true,
          status: true,
          title: true,
          urgency: true,
          milestones: {
            select: {
              id: true,
              milestoneType: true,
              notes: true,
              recordedAt: true,
              actor: { select: { id: true, name: true } },
            },
            orderBy: { recordedAt: "asc" },
          },
        },
      },
    },
    orderBy: [
      { status: "asc" }, // Active statuses first
      { updatedAt: "desc" },
    ],
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
      <DriverWorkspaceClient
        shipments={shipments.map((s) => ({
          ...s,
          latestRecordedAt: s.latestRecordedAt?.toISOString() ?? null,
          updatedAt: s.updatedAt.toISOString(),
          alerts: s.alerts.map((a) => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
          })),
          rescueOpportunity: s.rescueOpportunity
            ? {
                ...s.rescueOpportunity,
                milestones: s.rescueOpportunity.milestones.map((m) => ({
                  ...m,
                  recordedAt: m.recordedAt.toISOString(),
                })),
              }
            : null,
        }))}
        driverId={user.id}
      />
    </AppShell>
  );
}
