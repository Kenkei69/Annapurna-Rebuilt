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
    include: {
      shipment: true,
      acknowledgedBy: true,
      resolvedBy: true,
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
      <AlertsClient alerts={alerts} userRole={user.role} />
    </AppShell>
  );
}
