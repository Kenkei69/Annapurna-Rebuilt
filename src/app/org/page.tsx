import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { OrgSettingsClient } from "./OrgSettingsClient";

export default async function OrgSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const primaryMembership = user.memberships[0];
  if (!primaryMembership) {
    redirect("/dashboard");
  }

  const orgId = primaryMembership.organizationId;

  const [org, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        createdAt: true,
        partnerProfile: {
          select: {
            id: true,
            facilityName: true,
            facilityType: true,
            address: true,
            capacityAvailableKg: true,
            tempRangeMin: true,
            tempRangeMax: true,
            contactEmail: true,
            contactPhone: true,
            onboardingComplete: true,
            isActive: true,
            verificationStatus: true,
          },
        },
      },
    }),
    prisma.membership.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        orgRole: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            // passwordHash intentionally excluded
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!org) redirect("/dashboard");

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
      <OrgSettingsClient
        org={org}
        members={members}
        currentUserId={user.id}
        currentOrgRole={primaryMembership.orgRole}
      />
    </AppShell>
  );
}
