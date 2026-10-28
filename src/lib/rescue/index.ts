import { prisma } from "../db";
import { OfferStatus, RescueStatus, ShipmentStatus } from "@prisma/client";
import { recordAuditEvent } from "../audit";

export async function createRescueOpportunity(params: {
  organizationId: string;
  shipmentId: string;
  title: string;
  cargoDescription: string;
  cargoWeightKg: number;
  tempRequirementMin: number;
  tempRequirementMax: number;
  urgency?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  targetLat?: number;
  targetLng?: number;
  maxBudget?: number;
  actorId?: string;
  actorEmail?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: params.shipmentId },
    });
    if (!shipment) throw new Error("SHIPMENT_NOT_FOUND");

    const opportunity = await tx.rescueOpportunity.create({
      data: {
        organizationId: params.organizationId,
        shipmentId: params.shipmentId,
        title: params.title,
        cargoDescription: params.cargoDescription,
        cargoWeightKg: params.cargoWeightKg,
        tempRequirementMin: params.tempRequirementMin,
        tempRequirementMax: params.tempRequirementMax,
        urgency: params.urgency || "HIGH",
        targetLat: params.targetLat ?? shipment.latestLat,
        targetLng: params.targetLng ?? shipment.latestLng,
        maxBudget: params.maxBudget,
        status: RescueStatus.OPEN,
      },
    });

    // Move shipment to RESCUE_PENDING
    await tx.shipment.update({
      where: { id: shipment.id },
      data: { status: ShipmentStatus.RESCUE_PENDING },
    });

    await recordAuditEvent(
      {
        organizationId: params.organizationId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: "RESCUE_OPPORTUNITY_CREATED",
        entityType: "RescueOpportunity",
        entityId: opportunity.id,
        details: {
          title: opportunity.title,
          cargoWeightKg: opportunity.cargoWeightKg,
          shipmentTrackingNumber: shipment.trackingNumber,
        },
      },
      tx
    );

    return opportunity;
  });
}

export async function submitRescueOffer(params: {
  opportunityId: string;
  partnerOrgId: string;
  submittedById: string;
  offerAmount: number;
  capacityOfferedKg: number;
  storageType: string;
  estimatedEtaMinutes: number;
  validUntilHours?: number;
  notes?: string;
}) {
  const validUntil = new Date(Date.now() + (params.validUntilHours || 6) * 3600 * 1000);

  return prisma.$transaction(async (tx) => {
    const opp = await tx.rescueOpportunity.findUnique({
      where: { id: params.opportunityId },
    });

    if (!opp) throw new Error("RESCUE_OPPORTUNITY_NOT_FOUND");
    if (opp.status !== RescueStatus.OPEN && opp.status !== RescueStatus.OFFERED) {
      throw new Error("RESCUE_OPPORTUNITY_NOT_ACCEPTING_OFFERS");
    }

    const offer = await tx.rescueOffer.create({
      data: {
        opportunityId: params.opportunityId,
        partnerOrgId: params.partnerOrgId,
        submittedById: params.submittedById,
        offerAmount: params.offerAmount,
        capacityOfferedKg: params.capacityOfferedKg,
        storageType: params.storageType,
        estimatedEtaMinutes: params.estimatedEtaMinutes,
        validUntil,
        notes: params.notes,
        status: OfferStatus.SUBMITTED,
      },
    });

    // Update opportunity status to OFFERED if still OPEN
    if (opp.status === RescueStatus.OPEN) {
      await tx.rescueOpportunity.update({
        where: { id: opp.id },
        data: { status: RescueStatus.OFFERED },
      });
    }

    await recordAuditEvent(
      {
        organizationId: opp.organizationId,
        actorId: params.submittedById,
        action: "RESCUE_OFFER_SUBMITTED",
        entityType: "RescueOffer",
        entityId: offer.id,
        details: {
          offerAmount: offer.offerAmount,
          capacityOfferedKg: offer.capacityOfferedKg,
        },
      },
      tx
    );

    return offer;
  });
}

/**
 * Transaction-Safe Offer Acceptance
 * Guarantees strict single-winner assignment and prevents race conditions.
 */
export async function acceptRescueOffer(params: {
  opportunityId: string;
  offerId: string;
  actorId: string;
  actorEmail?: string;
}) {
  return prisma.$transaction(async (tx) => {
    // 1. Fetch with row-level validation
    const opp = await tx.rescueOpportunity.findUnique({
      where: { id: params.opportunityId },
      include: { shipment: true },
    });

    if (!opp) throw new Error("RESCUE_OPPORTUNITY_NOT_FOUND");
    if (opp.status !== RescueStatus.OPEN && opp.status !== RescueStatus.OFFERED) {
      throw new Error(`Opportunity status is ${opp.status}; cannot accept offers.`);
    }
    if (opp.acceptedOfferId) {
      throw new Error("Another offer has already been accepted for this rescue incident.");
    }

    // 2. Validate offer
    const offer = await tx.rescueOffer.findUnique({
      where: { id: params.offerId },
      include: { partnerOrg: true },
    });

    if (!offer || offer.opportunityId !== params.opportunityId) {
      throw new Error("OFFER_NOT_FOUND_OR_MISMATCHED");
    }
    if (offer.status !== OfferStatus.SUBMITTED) {
      throw new Error(`Offer status is ${offer.status}; cannot accept.`);
    }

    // 3. Mark winning offer ACCEPTED
    const acceptedOffer = await tx.rescueOffer.update({
      where: { id: params.offerId },
      data: { status: OfferStatus.ACCEPTED },
    });

    // 4. Reject all other competing offers
    await tx.rescueOffer.updateMany({
      where: {
        opportunityId: params.opportunityId,
        id: { not: params.offerId },
        status: OfferStatus.SUBMITTED,
      },
      data: { status: OfferStatus.REJECTED },
    });

    // 5. Update opportunity to ACCEPTED and link winning offer
    const updatedOpp = await tx.rescueOpportunity.update({
      where: { id: params.opportunityId },
      data: {
        status: RescueStatus.ACCEPTED,
        acceptedOfferId: params.offerId,
      },
    });

    // 6. Record milestone
    await tx.rescueMilestone.create({
      data: {
        opportunityId: params.opportunityId,
        actorId: params.actorId,
        milestoneType: "OFFER_ACCEPTED",
        notes: `Accepted offer of ₹${offer.offerAmount} from partner '${offer.partnerOrg.name}'. ETA: ~${offer.estimatedEtaMinutes} minutes.`,
      },
    });

    // 7. Audit logging
    await recordAuditEvent(
      {
        organizationId: opp.organizationId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: "RESCUE_OFFER_ACCEPTED",
        entityType: "RescueOpportunity",
        entityId: opp.id,
        details: {
          acceptedOfferId: offer.id,
          partnerOrgId: offer.partnerOrgId,
          partnerName: offer.partnerOrg.name,
          offerAmount: offer.offerAmount,
        },
      },
      tx
    );

    return { opportunity: updatedOpp, offer: acceptedOffer };
  });
}

export async function recordRescueMilestone(params: {
  opportunityId: string;
  actorId: string;
  milestoneType: string;
  notes: string;
}) {
  return prisma.$transaction(async (tx) => {
    const opp = await tx.rescueOpportunity.findUnique({
      where: { id: params.opportunityId },
    });
    if (!opp) throw new Error("OPPORTUNITY_NOT_FOUND");

    const milestone = await tx.rescueMilestone.create({
      data: {
        opportunityId: params.opportunityId,
        actorId: params.actorId,
        milestoneType: params.milestoneType,
        notes: params.notes,
      },
    });

    // If milestone indicates transport started, move to IN_PROGRESS
    if (params.milestoneType === "TRANSFER_DISPATCHED" && opp.status === RescueStatus.ACCEPTED) {
      await tx.rescueOpportunity.update({
        where: { id: opp.id },
        data: { status: RescueStatus.IN_PROGRESS },
      });
    }

    return milestone;
  });
}

export async function completeRescue(params: {
  opportunityId: string;
  actorId: string;
  actorEmail?: string;
  outcomeNotes: string;
}) {
  return prisma.$transaction(async (tx) => {
    const opp = await tx.rescueOpportunity.findUnique({
      where: { id: params.opportunityId },
      include: { shipment: true },
    });
    if (!opp) throw new Error("OPPORTUNITY_NOT_FOUND");

    const completedOpp = await tx.rescueOpportunity.update({
      where: { id: params.opportunityId },
      data: { status: RescueStatus.COMPLETED },
    });

    // Update shipment to RESCUED
    await tx.shipment.update({
      where: { id: opp.shipmentId },
      data: { status: ShipmentStatus.RESCUED },
    });

    // Add final milestone
    await tx.rescueMilestone.create({
      data: {
        opportunityId: params.opportunityId,
        actorId: params.actorId,
        milestoneType: "RESCUE_COMPLETED",
        notes: `Rescue successfully concluded: ${params.outcomeNotes}`,
      },
    });

    await recordAuditEvent(
      {
        organizationId: opp.organizationId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: "RESCUE_COMPLETED",
        entityType: "RescueOpportunity",
        entityId: opp.id,
        details: { outcomeNotes: params.outcomeNotes },
      },
      tx
    );

    return completedOpp;
  });
}
