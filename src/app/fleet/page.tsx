import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { FleetClient } from "./FleetClient";

export default async function FleetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = user.memberships[0]?.organizationId;

  const vehicles = await prisma.vehicle.findMany({
    where: user.role === "ADMIN" ? {} : { organizationId: orgId },
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
      <FleetClient vehicles={vehicles} />
    </AppShell>
  );
}
