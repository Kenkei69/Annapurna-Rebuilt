import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedActor, getShipmentsWhereClause } from "@/lib/auth/policy";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { ShipmentListClient } from "./ShipmentListClient";
import { AlertStatus } from "@prisma/client";

export default async function ShipmentsListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const actor = await getAuthorizedActor();
  if (!actor) redirect("/login");

  const shipmentsWhere = getShipmentsWhereClause(actor);

  const shipments = await prisma.shipment.findMany({
    where: shipmentsWhere,
    select: {
      id: true,
      organizationId: true,
      trackingNumber: true,
      title: true,
      cargoType: true,
      tempMin: true,
      tempMax: true,
      status: true,
      originName: true,
      destName: true,
      latestTemperature: true,
      latestRecordedAt: true,
      createdAt: true,
      updatedAt: true,
      assignedVehicle: {
        select: {
          id: true,
          licensePlate: true,
          makeModel: true,
          reeferType: true,
          status: true,
        },
      },
      assignedDevice: {
        // Safe projection: NO apiKeyHash!
        select: {
          id: true,
          deviceIdentifier: true,
          hardwareModel: true,
          status: true,
          lastSeenAt: true,
        },
      },
      alerts: {
        where: { status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] } },
        select: {
          id: true,
          ruleCode: true,
          severity: true,
          status: true,
          summary: true,
        },
      },
      rescueOpportunity: {
        select: {
          id: true,
          status: true,
          title: true,
          urgency: true,
          acceptedOfferId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Safe device and vehicle list for dispatch dialogs
  const resourceWhere = actor.primaryOrgId ? { organizationId: actor.primaryOrgId } : { id: "NONE" };

  const [vehicles, devices, driverMemberships] = await Promise.all([
    actor.role === "OPERATOR" || actor.role === "ADMIN"
      ? prisma.vehicle.findMany({
          where: resourceWhere,
          select: {
            id: true,
            licensePlate: true,
            makeModel: true,
            reeferType: true,
            status: true,
          },
        })
      : [],
    actor.role === "OPERATOR" || actor.role === "ADMIN"
      ? prisma.device.findMany({
          where: resourceWhere,
          select: {
            id: true,
            deviceIdentifier: true,
            hardwareModel: true,
            status: true,
            lastSeenAt: true,
          },
        })
      : [],
    (actor.role === "OPERATOR" || actor.role === "ADMIN") && actor.primaryOrgId
      ? prisma.membership.findMany({
          where: {
            organizationId: actor.primaryOrgId,
            user: { role: "DRIVER" },
          },
          select: {
            user: { select: { id: true, name: true, email: true } },
          },
        })
      : [],
  ]);

  const drivers = driverMemberships.map((m) => m.user);

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
      <ShipmentListClient
        shipments={shipments.map((s) => ({
          ...s,
          latestRecordedAt: s.latestRecordedAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          assignedDevice: s.assignedDevice
            ? {
                ...s.assignedDevice,
                lastSeenAt: s.assignedDevice.lastSeenAt?.toISOString() ?? null,
              }
            : null,
        }))}
        vehicles={vehicles}
        devices={devices.map((d) => ({
          ...d,
          lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        }))}
        drivers={drivers}
        isOperator={actor.role === "OPERATOR" || actor.role === "ADMIN"}
      />
    </AppShell>
  );
}
