import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { FleetConsoleClient } from "./FleetConsoleClient";

export default async function FleetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = user.memberships[0]?.organizationId;
  const whereOrg = user.role === "ADMIN" ? {} : { organizationId: orgId };

  // Fetch all shipments for organization with full relations
  const shipments = await prisma.shipment.findMany({
    where: whereOrg,
    select: {
      id: true,
      trackingNumber: true,
      title: true,
      cargoType: true,
      tempMin: true,
      tempMax: true,
      status: true,
      originName: true,
      originLat: true,
      originLng: true,
      destName: true,
      destLat: true,
      destLng: true,
      latestTemperature: true,
      latestHumidity: true,
      latestLat: true,
      latestLng: true,
      latestRecordedAt: true,
      createdAt: true,
      updatedAt: true,
      assignedVehicle: {
        select: {
          id: true,
          licensePlate: true,
          makeModel: true,
          reeferType: true,
        },
      },
      assignedDevice: {
        select: {
          id: true,
          deviceIdentifier: true,
          hardwareModel: true,
          status: true,
          isSimulated: true,
          lastSeenAt: true,
        },
      },
      assignedDriver: {
        select: {
          id: true,
          name: true,
          email: true,
        },
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
      },
      rescueOpportunity: {
        select: {
          id: true,
          status: true,
          urgency: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Fetch vehicles for organization
  const vehicles = await prisma.vehicle.findMany({
    where: whereOrg,
    select: {
      id: true,
      organizationId: true,
      licensePlate: true,
      makeModel: true,
      reeferType: true,
      tempCapabilityMin: true,
      tempCapabilityMax: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      shipments: {
        where: { status: { in: ["DISPATCHED", "IN_TRANSIT", "ALERTED", "RESCUE_PENDING"] } },
        select: { id: true, trackingNumber: true, title: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch devices for organization
  const devices = await prisma.device.findMany({
    where: {
      ...whereOrg,
      status: "ACTIVE",
    },
    select: {
      id: true,
      deviceIdentifier: true,
      hardwareModel: true,
      status: true,
    },
    orderBy: { deviceIdentifier: "asc" },
  });

  // Fetch drivers for organization
  const drivers = await prisma.user.findMany({
    where: {
      role: "DRIVER",
      ...(user.role === "ADMIN"
        ? {}
        : {
            memberships: {
              some: { organizationId: orgId },
            },
          }),
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
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
      <FleetConsoleClient
        shipments={shipments}
        vehicles={vehicles}
        devices={devices}
        drivers={drivers}
        userRole={user.role}
        organization={user.memberships[0]?.organization}
      />
    </AppShell>
  );
}
