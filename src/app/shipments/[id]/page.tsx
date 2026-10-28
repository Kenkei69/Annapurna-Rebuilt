import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertOrgAccess } from "@/lib/org";
import { AppShell } from "@/components/layout/AppShell";
import { ShipmentDetailClient } from "@/components/shipments/ShipmentDetailClient";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      organization: true,
      assignedVehicle: true,
      assignedDevice: true,
      assignedDriver: true,
      alerts: {
        include: {
          acknowledgedBy: true,
          resolvedBy: true,
        },
        orderBy: { createdAt: "desc" },
      },
      rescueOpportunity: {
        include: {
          offers: {
            include: { partnerOrg: true },
          },
          milestones: {
            include: { actor: true },
          },
        },
      },
      telemetryReadings: {
        orderBy: { recordedAt: "desc" },
        take: 30,
      },
    },
  });

  if (!shipment) {
    notFound();
  }

  // Tenant Boundary Check: Non-admins can only view their own organization's shipments
  // (or assigned driver)
  if (user.role !== "ADMIN" && user.role !== "PARTNER") {
    try {
      await assertOrgAccess(user.id, user.role, shipment.organizationId);
    } catch {
      // If driver is specifically assigned, allow view
      if (user.role === "DRIVER" && shipment.assignedDriverId === user.id) {
        // Driver authorized for assigned shipment
      } else {
        redirect("/dashboard");
      }
    }
  }

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
      <ShipmentDetailClient shipment={shipment} userRole={user.role} />
    </AppShell>
  );
}
