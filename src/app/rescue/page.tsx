import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { RescueHubClient } from "@/components/rescue/RescueHubClient";

export default async function RescuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = user.memberships[0]?.organizationId;
  const isPartner = user.memberships[0]?.organization?.type === "RESCUE_PARTNER";

  // If partner, fetch all open/offered/accepted opportunities
  // If fleet operator, fetch their organization's opportunities
  // If admin, fetch all
  const opportunities = await prisma.rescueOpportunity.findMany({
    where:
      user.role === "ADMIN" || isPartner
        ? {}
        : { organizationId: orgId },
    include: {
      organization: true,
      shipment: true,
      offers: {
        include: { partnerOrg: true },
        orderBy: { createdAt: "desc" },
      },
      milestones: {
        include: { actor: true },
        orderBy: { recordedAt: "asc" },
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
      <RescueHubClient
        opportunities={opportunities}
        userRole={user.role}
        userOrgId={orgId || ""}
        isPartner={isPartner}
      />
    </AppShell>
  );
}
