import { prisma } from "../db";
import { OfferStatus, RescueStatus, ShipmentStatus } from "@prisma/client";
import { recordAuditEvent } from "../audit";
import {
  canTransitionShipment,
  isValidRescueMilestone,
} from "../lifecycle";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../errors";

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
      include: { rescueOpportunity: true },
    });

    if (!shipment) {
      throw new NotFoundError("SHIPMENT_NOT_FOUND");
    }

    // Invariant: Shipment must belong to the caller's organization
    if (shipment.organizationId !== params.organizationId) {
      throw new ForbiddenError(
        "CROSS_ORG_FORBIDDEN: Cannot create a rescue opportunity for a shipment belonging to another organization."
      );
    }

    // Invariant: Only one active rescue opportunity per shipment
    if (
      shipment.rescueOpportunity &&
      shipment.rescueOpportunity.status !== RescueStatus.CANCELLED &&
      shipment.rescueOpportunity.status !== RescueStatus.COMPLETED
    ) {
      throw new ConflictError(
        "RESCUE_ALREADY_EXISTS: An active rescue opportunity already exists for this shipment."
      );
    }

    // Invariant: Shipment must be in a state eligible for rescue (e.g. ALERTED or IN_TRANSIT)
    if (
      shipment.status === ShipmentStatus.DELIVERED ||
      shipment.status === ShipmentStatus.CANCELLED
    ) {
      throw new ConflictError(
        `SHIPMENT_INELIGIBLE: Cannot create a rescue opportunity for a shipment in '${shipment.status}' status.`
      );
    }

    if (params.tempRequirementMin >= params.tempRequirementMax) {
      throw new ValidationError(
        "tempRequirementMin must be strictly less than tempRequirementMax."
      );
    }

    if (params.cargoWeightKg <= 0) {
      throw new ValidationError("cargoWeightKg must be greater than zero.");
    }

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
    if (canTransitionShipment(shipment.status, ShipmentStatus.RESCUE_PENDING)) {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: ShipmentStatus.RESCUE_PENDING },
      });
    }

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
  if (params.offerAmount <= 0) {
    throw new ValidationError("offerAmount must be positive.");
  }
  if (params.capacityOfferedKg <= 0) {
    throw new ValidationError("capacityOfferedKg must be positive.");
  }

  const validUntil = new Date(
    Date.now() + (params.validUntilHours || 6) * 3600 * 1000
  );

  return prisma.$transaction(async (tx) => {
    // 1. Verify Partner Facility Onboarding and Membership
    const partnerMembership = await tx.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: params.submittedById,
          organizationId: params.partnerOrgId,
        },
      },
    });

    if (!partnerMembership) {
      throw new ForbiddenError(
        "UNAUTHORIZED_PARTNER_MEMBERSHIP: Submitting user is not an active member of the designated partner organization."
      );
    }

    const partnerProfile = await tx.rescuePartnerProfile.findUnique({
      where: { organizationId: params.partnerOrgId },
    });

    if (
      !partnerProfile ||
      !partnerProfile.onboardingComplete ||
      !partnerProfile.isActive
    ) {
      throw new ForbiddenError(
        "PARTNER_ONBOARDING_INCOMPLETE: Partner organization must complete facility onboarding and verified profile setup before submitting rescue offers."
      );
    }

    // 2. Row-level lock on opportunity to coordinate race with concurrent acceptance
    const [opp] = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        organizationId: string;
        cargoWeightKg: number;
        tempRequirementMin: number;
        tempRequirementMax: number;
      }>
    >`
      SELECT "id", "status", "organizationId", "cargoWeightKg", "tempRequirementMin", "tempRequirementMax"
      FROM "RescueOpportunity"
      WHERE "id" = ${params.opportunityId}
      FOR UPDATE
    `;

    if (!opp) {
      throw new NotFoundError("RESCUE_OPPORTUNITY_NOT_FOUND");
    }

    // Prevent partner from bidding on their own fleet's rescue
    if (opp.organizationId === params.partnerOrgId) {
      throw new ForbiddenError(
        "CANNOT_BID_ON_OWN_INCIDENT: A fleet organization cannot submit partner rescue offers on its own cargo incidents."
      );
    }

    if (
      opp.status !== RescueStatus.OPEN &&
      opp.status !== RescueStatus.OFFERED
    ) {
      throw new ConflictError(
        `RESCUE_NOT_ACCEPTING_OFFERS: Opportunity status is '${opp.status}'. Offers can only be submitted for OPEN or OFFERED incidents.`
      );
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
 * Transaction-Safe Single-Winner Offer Acceptance
 *
 * Concurrency Strategy:
 * 1. Executes PostgreSQL row-level lock `SELECT ... FOR UPDATE` on the target RescueOpportunity.
 * 2. Competing concurrent callers on the same opportunity row are serialized.
 * 3. Idempotent check: if the exact offer is already accepted, returns without error.
 * 4. Conflict check: if another offer was accepted or status is not OPEN/OFFERED, throws ConflictError.
 * 5. Offer validation: checks existence, belonging, expiration, and partner onboarding.
 * 6. Atomic claim: winning offer marked ACCEPTED, all other competing offers marked REJECTED,
 *    and opportunity.acceptedOfferId bound atomically.
 */
export async function acceptRescueOffer(params: {
  opportunityId: string;
  offerId: string;
  actorId: string;
  actorEmail?: string;
}) {
  return prisma.$transaction(async (tx) => {
    // 1. Row-level exclusive lock on the opportunity row
    const [oppRow] = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        acceptedOfferId: string | null;
        organizationId: string;
        shipmentId: string;
        cargoWeightKg: number;
        tempRequirementMin: number;
        tempRequirementMax: number;
      }>
    >`
      SELECT "id", "status", "acceptedOfferId", "organizationId", "shipmentId", "cargoWeightKg", "tempRequirementMin", "tempRequirementMax"
      FROM "RescueOpportunity"
      WHERE "id" = ${params.opportunityId}
      FOR UPDATE
    `;

    if (!oppRow) {
      throw new NotFoundError("RESCUE_OPPORTUNITY_NOT_FOUND");
    }

    // Authorization check: Verify actor has fleet owner/dispatcher authority or admin role
    const callerUser = await tx.user.findUnique({
      where: { id: params.actorId },
      select: { role: true },
    });
    const isAdmin = callerUser?.role === "ADMIN";

    const callerMembership = await tx.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: params.actorId,
          organizationId: oppRow.organizationId,
        },
      },
    });

    const isFleetAuth =
      callerMembership &&
      (callerMembership.orgRole === "OWNER" || callerMembership.orgRole === "DISPATCHER");

    if (!isAdmin && !isFleetAuth) {
      throw new ForbiddenError(
        "FORBIDDEN: Only fleet owners, dispatchers, or administrators can accept rescue offers."
      );
    }

    // 2. Idempotency Check: if this exact offer is already accepted, return idempotently
    if (
      oppRow.acceptedOfferId === params.offerId &&
      oppRow.status === RescueStatus.ACCEPTED
    ) {
      const winningOffer = await tx.rescueOffer.findUnique({
        where: { id: params.offerId },
      });
      return { opportunity: oppRow, offer: winningOffer, idempotent: true };
    }

    // 3. Concurrency Conflict Checks
    if (
      oppRow.status !== RescueStatus.OPEN &&
      oppRow.status !== RescueStatus.OFFERED
    ) {
      throw new ConflictError(
        `CONCURRENT_ACCEPTANCE_CONFLICT: Rescue opportunity status is '${oppRow.status}'; cannot accept offers.`
      );
    }

    if (oppRow.acceptedOfferId) {
      throw new ConflictError(
        "CONCURRENT_ACCEPTANCE_CONFLICT: Another offer has already been accepted for this rescue incident."
      );
    }

    // 4. Validate Offer
    const offer = await tx.rescueOffer.findUnique({
      where: { id: params.offerId },
      include: {
        partnerOrg: {
          include: { partnerProfile: true },
        },
      },
    });

    if (!offer || offer.opportunityId !== params.opportunityId) {
      throw new ValidationError(
        "OFFER_MISMATCH: Offer does not exist or does not belong to this rescue opportunity."
      );
    }

    if (offer.status !== OfferStatus.SUBMITTED) {
      throw new ConflictError(
        `OFFER_NOT_SUBMITTED: Offer status is '${offer.status}'; cannot accept.`
      );
    }

    // Expiry Check at acceptance time: persist expired status cleanly without rollback
    if (offer.validUntil <= new Date()) {
      await prisma.rescueOffer.update({
        where: { id: offer.id },
        data: { status: OfferStatus.EXPIRED },
      });
      throw new ConflictError(
        `OFFER_EXPIRED: This offer expired at ${offer.validUntil.toISOString()}`
      );
    }

    // Partner Onboarding Check
    const partnerProfile = offer.partnerOrg.partnerProfile;
    if (
      !partnerProfile ||
      !partnerProfile.onboardingComplete ||
      !partnerProfile.isActive
    ) {
      throw new ForbiddenError(
        "PARTNER_NOT_ONBOARDED: Offering partner facility has not completed verified onboarding."
      );
    }

    // Suitability Validation: Capacity & Temperature Envelopes
    if (offer.capacityOfferedKg < oppRow.cargoWeightKg) {
      throw new ValidationError(
        `INSUFFICIENT_CAPACITY: Offered capacity (${offer.capacityOfferedKg} kg) cannot accommodate cargo weight (${oppRow.cargoWeightKg} kg).`
      );
    }

    if (
      partnerProfile.tempRangeMin !== null &&
      partnerProfile.tempRangeMax !== null
    ) {
      if (
        partnerProfile.tempRangeMin > oppRow.tempRequirementMin ||
        partnerProfile.tempRangeMax < oppRow.tempRequirementMax
      ) {
        throw new ValidationError(
          `INCOMPATIBLE_TEMPERATURE_CAPABILITY: Partner facility range [${partnerProfile.tempRangeMin}°C, ${partnerProfile.tempRangeMax}°C] cannot maintain required cargo range [${oppRow.tempRequirementMin}°C, ${oppRow.tempRequirementMax}°C].`
        );
      }
    }

    // 5. Atomic State Transitions
    // Mark winning offer ACCEPTED
    const acceptedOffer = await tx.rescueOffer.update({
      where: { id: params.offerId },
      data: { status: OfferStatus.ACCEPTED },
    });

    // Atomically reject all other competing submitted offers for this opportunity
    await tx.rescueOffer.updateMany({
      where: {
        opportunityId: params.opportunityId,
        id: { not: params.offerId },
        status: OfferStatus.SUBMITTED,
      },
      data: { status: OfferStatus.REJECTED },
    });

    // Update opportunity status and bind winning offer
    const updatedOpp = await tx.rescueOpportunity.update({
      where: { id: params.opportunityId },
      data: {
        status: RescueStatus.ACCEPTED,
        acceptedOfferId: params.offerId,
      },
    });

    // 6. Record Milestone
    await tx.rescueMilestone.create({
      data: {
        opportunityId: params.opportunityId,
        actorId: params.actorId,
        milestoneType: "OFFER_ACCEPTED",
        notes: `Accepted offer of ₹${offer.offerAmount} from partner '${offer.partnerOrg.name}'. ETA: ~${offer.estimatedEtaMinutes} min.`,
      },
    });

    // 7. Transactional Audit Event
    await recordAuditEvent(
      {
        organizationId: oppRow.organizationId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: "RESCUE_OFFER_ACCEPTED",
        entityType: "RescueOpportunity",
        entityId: oppRow.id,
        details: {
          acceptedOfferId: offer.id,
          partnerOrgId: offer.partnerOrgId,
          partnerName: offer.partnerOrg.name,
          offerAmount: offer.offerAmount,
        },
      },
      tx
    );

    return { opportunity: updatedOpp, offer: acceptedOffer, idempotent: false };
  });
}

export async function recordRescueMilestone(params: {
  opportunityId: string;
  actorId: string;
  milestoneType: string;
  notes: string;
  actorOrgId?: string;
  actorRole?: string;
}) {
  if (!isValidRescueMilestone(params.milestoneType)) {
    throw new ValidationError(
      `INVALID_MILESTONE_TYPE: Milestone type '${params.milestoneType}' is not supported.`
    );
  }

  if (!params.notes || params.notes.trim().length < 3) {
    throw new ValidationError("Milestone notes must be at least 3 characters long.");
  }

  return prisma.$transaction(async (tx) => {
    // Acquire row-level lock on opportunity to prevent racing milestone/completion updates
    const [oppRow] = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        organizationId: string;
        shipmentId: string;
      }>
    >`
      SELECT "id", "status", "organizationId", "shipmentId"
      FROM "RescueOpportunity"
      WHERE "id" = ${params.opportunityId}
      FOR UPDATE
    `;

    if (!oppRow) {
      throw new NotFoundError("RESCUE_OPPORTUNITY_NOT_FOUND");
    }

    const opp = await tx.rescueOpportunity.findUnique({
      where: { id: params.opportunityId },
      include: {
        shipment: true,
        offers: {
          where: { status: OfferStatus.ACCEPTED },
        },
      },
    });

    if (!opp) {
      throw new NotFoundError("RESCUE_OPPORTUNITY_NOT_FOUND");
    }

    // State machine check: milestones can only be recorded when accepted or in progress
    if (
      opp.status !== RescueStatus.ACCEPTED &&
      opp.status !== RescueStatus.IN_PROGRESS
    ) {
      throw new ConflictError(
        `INVALID_STATE_TRANSITION: Cannot record milestones for an opportunity in '${opp.status}' status.`
      );
    }

    // Authorization check: Actor must be fleet owner/dispatcher, assigned driver, winning partner org, or admin
    const actorUser = await tx.user.findUnique({
      where: { id: params.actorId },
      select: { role: true },
    });
    const isAdmin = actorUser?.role === "ADMIN";

    const userMemberships = await tx.membership.findMany({
      where: { userId: params.actorId },
      select: { organizationId: true, orgRole: true },
    });

    const fleetMembership = userMemberships.find((m) => m.organizationId === opp.organizationId);
    const isFleetAuth =
      fleetMembership &&
      (fleetMembership.orgRole === "OWNER" || fleetMembership.orgRole === "DISPATCHER");

    const winningOffer = opp.offers[0];
    const isDriver = opp.shipment.assignedDriverId === params.actorId;
    const isWinningPartner =
      Boolean(winningOffer && userMemberships.some((m) => m.organizationId === winningOffer.partnerOrgId));

    if (!isFleetAuth && !isDriver && !isWinningPartner && !isAdmin) {
      throw new ForbiddenError(
        "FORBIDDEN: Only authorized participants (fleet owner, dispatcher, assigned driver, or winning rescue partner) can log milestones."
      );
    }

    const milestone = await tx.rescueMilestone.create({
      data: {
        opportunityId: params.opportunityId,
        actorId: params.actorId,
        milestoneType: params.milestoneType,
        notes: params.notes.trim(),
      },
    });

    // Progress state machine transition
    if (
      (params.milestoneType === "EN_ROUTE_TO_CARGO" ||
        params.milestoneType === "ARRIVED_AT_SCENE" ||
        params.milestoneType === "TRANSFER_IN_PROGRESS") &&
      opp.status === RescueStatus.ACCEPTED
    ) {
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
  if (!params.outcomeNotes || params.outcomeNotes.trim().length < 5) {
    throw new ValidationError(
      "Outcome verification notes are required (minimum 5 characters)."
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Exclusive lock on RescueOpportunity
    const [opp] = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        acceptedOfferId: string | null;
        organizationId: string;
        shipmentId: string;
      }>
    >`
      SELECT "id", "status", "acceptedOfferId", "organizationId", "shipmentId"
      FROM "RescueOpportunity"
      WHERE "id" = ${params.opportunityId}
      FOR UPDATE
    `;

    if (!opp) {
      throw new NotFoundError("RESCUE_OPPORTUNITY_NOT_FOUND");
    }

    // 2. Lock associated Shipment in consistent order to prevent concurrent race transitions
    await tx.$queryRaw`
      SELECT "id" FROM "Shipment" WHERE "id" = ${opp.shipmentId} FOR UPDATE
    `;

    // 3. Idempotency: already completed
    if (opp.status === RescueStatus.COMPLETED) {
      return opp;
    }

    // 4. Authorization check: Actor must be fleet owner/dispatcher, assigned driver, winning partner, or admin
    const actorUser = await tx.user.findUnique({
      where: { id: params.actorId },
      select: { role: true },
    });
    const isAdmin = actorUser?.role === "ADMIN";

    const userMemberships = await tx.membership.findMany({
      where: { userId: params.actorId },
      select: { organizationId: true, orgRole: true },
    });

    const fleetMembership = userMemberships.find((m) => m.organizationId === opp.organizationId);
    const isFleetAuth =
      fleetMembership &&
      (fleetMembership.orgRole === "OWNER" || fleetMembership.orgRole === "DISPATCHER");

    const shipment = await tx.shipment.findUnique({
      where: { id: opp.shipmentId },
    });
    if (!shipment) {
      throw new NotFoundError("SHIPMENT_NOT_FOUND");
    }

    const isDriver = shipment.assignedDriverId === params.actorId;

    let isWinningPartner = false;
    if (opp.acceptedOfferId) {
      const winningOffer = await tx.rescueOffer.findUnique({
        where: { id: opp.acceptedOfferId },
      });
      isWinningPartner =
        Boolean(winningOffer && userMemberships.some((m) => m.organizationId === winningOffer.partnerOrgId));
    }

    if (!isFleetAuth && !isDriver && !isWinningPartner && !isAdmin) {
      throw new ForbiddenError(
        "FORBIDDEN: Only authorized participants (fleet owner/dispatcher, assigned driver, winning partner, or admin) can complete rescue."
      );
    }

    // 5. State machine check: must be in ACCEPTED or IN_PROGRESS
    if (
      opp.status !== RescueStatus.ACCEPTED &&
      opp.status !== RescueStatus.IN_PROGRESS
    ) {
      throw new ConflictError(
        `INVALID_STATE_TRANSITION: Cannot complete rescue from status '${opp.status}'. A winning offer must be accepted first.`
      );
    }

    if (!opp.acceptedOfferId) {
      throw new ConflictError(
        "INVALID_STATE_TRANSITION: Cannot complete rescue without an accepted assignment."
      );
    }

    if (!canTransitionShipment(shipment.status, ShipmentStatus.RESCUED)) {
      throw new ConflictError(
        `INVALID_SHIPMENT_TRANSITION: Cannot transition shipment from status '${shipment.status}' to RESCUED.`
      );
    }

    // Transition opportunity to COMPLETED
    const completedOpp = await tx.rescueOpportunity.update({
      where: { id: params.opportunityId },
      data: { status: RescueStatus.COMPLETED },
    });

    // Atomically transition shipment to RESCUED
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
        notes: `Rescue successfully concluded: ${params.outcomeNotes.trim()}`,
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
        details: { outcomeNotes: params.outcomeNotes.trim() },
      },
      tx
    );

    return completedOpp;
  });
}
