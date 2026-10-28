import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedActor, getRescueOpportunitiesWhereClause } from "@/lib/auth/policy";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { RescueHubClient } from "@/components/rescue/RescueHubClient";
import { UserRole } from "@prisma/client";

export default async function RescuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const actor = await getAuthorizedActor();
  if (!actor) redirect("/login");

  const isPartner = actor.role === UserRole.PARTNER;
  const partnerProfile =
    isPartner && actor.primaryOrgId
      ? await prisma.rescuePartnerProfile.findUnique({
          where: { organizationId: actor.primaryOrgId },
        })
      : null;

  const whereClause = getRescueOpportunitiesWhereClause(actor);

  // Offers filtering: Partners only see their own offers (no competitor leak)
  const offersWhere = isPartner && actor.primaryOrgId
    ? { partnerOrgId: actor.primaryOrgId }
    : {};

  const opportunities = await prisma.rescueOpportunity.findMany({
    where: whereClause,
    select: {
      id: true,
      organizationId: true,
      shipmentId: true,
      title: true,
      cargoDescription: true,
      cargoWeightKg: true,
      tempRequirementMin: true,
      tempRequirementMax: true,
      urgency: true,
      targetLat: true,
      targetLng: true,
      maxBudget: isPartner ? null : true, // Redacted from competing partners
      status: true,
      acceptedOfferId: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: { id: true, name: true, slug: true, type: true },
      },
      shipment: {
        select: {
          id: true,
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
        },
      },
      offers: {
        where: offersWhere,
        select: {
          id: true,
          opportunityId: true,
          partnerOrgId: true,
          offerAmount: true,
          capacityOfferedKg: true,
          storageType: true,
          estimatedEtaMinutes: true,
          status: true,
          notes: true,
          createdAt: true,
          partnerOrg: {
            select: { id: true, name: true, slug: true },
          },
          submittedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      milestones: {
        select: {
          id: true,
          opportunityId: true,
          actorId: true,
          milestoneType: true,
          notes: true,
          recordedAt: true,
          // Safe actor projection: NO passwordHash!
          actor: {
            select: { id: true, name: true, email: true },
          },
        },
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
        userOrgId={actor.primaryOrgId || ""}
        isPartner={isPartner}
        partnerProfile={partnerProfile}
      />
    </AppShell>
  );
}
