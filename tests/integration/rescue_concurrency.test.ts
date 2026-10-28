import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import {
  createRescueOpportunity,
  submitRescueOffer,
  acceptRescueOffer,
} from "../../src/lib/rescue";
import { OfferStatus, RescueStatus } from "@prisma/client";

test("Cargo Rescue Concurrency - True PostgreSQL concurrent acceptance race condition", async () => {
  const fleetOrg = await prisma.organization.findUnique({
    where: { slug: "transcold-express" },
  });
  const partnerOrg = await prisma.organization.findUnique({
    where: { slug: "sahyadri-cold" },
  });
  const operator = await prisma.user.findUnique({
    where: { email: "operator@transcold.com" },
  });
  const partnerUser = await prisma.user.findUnique({
    where: { email: "director@sahyadricold.com" },
  });

  assert.ok(fleetOrg && partnerOrg && operator && partnerUser);

  // Setup shipment & opportunity
  const shipment = await prisma.shipment.create({
    data: {
      organizationId: fleetOrg.id,
      trackingNumber: `RACE-TEST-${Date.now().toString().slice(-6)}`,
      title: "Race Condition Stress Test Cargo",
      cargoType: "Biologics",
      tempMin: 2.0,
      tempMax: 8.0,
      originName: "Race Origin",
      destName: "Race Destination",
      status: "ALERTED",
    },
  });

  const opp = await createRescueOpportunity({
    organizationId: fleetOrg.id,
    shipmentId: shipment.id,
    title: "Concurrent Race Condition Opportunity",
    cargoDescription: "Simultaneous accept requests competing for single winner lock",
    cargoWeightKg: 800,
    tempRequirementMin: 2.0,
    tempRequirementMax: 8.0,
    actorId: operator.id,
  });

  // Submit two competing offers
  const offerA = await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 15000,
    capacityOfferedKg: 1000,
    storageType: "COLD_STORAGE",
    estimatedEtaMinutes: 25,
  });

  const offerB = await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 16500,
    capacityOfferedKg: 1200,
    storageType: "EMERGENCY_REEFER",
    estimatedEtaMinutes: 20,
  });

  // Launch both acceptance operations simultaneously against PostgreSQL
  const [resultA, resultB] = await Promise.allSettled([
    acceptRescueOffer({
      opportunityId: opp.id,
      offerId: offerA.id,
      actorId: operator.id,
    }),
    acceptRescueOffer({
      opportunityId: opp.id,
      offerId: offerB.id,
      actorId: operator.id,
    }),
  ]);

  // One must fulfill and one must reject
  const fulfilled = [resultA, resultB].filter((r) => r.status === "fulfilled");
  const rejected = [resultA, resultB].filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 1, "Exactly one offer acceptance must fulfill");
  assert.equal(rejected.length, 1, "Exactly one offer acceptance must reject with conflict");

  // Verify rejection reason is state conflict
  const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
  assert.match(
    rejectionReason.message,
    /cannot accept offers|already been accepted/,
    "Rejection reason must explicitly state single-winner or invalid status invariant"
  );

  // Check database invariants
  const refreshedOpp = await prisma.rescueOpportunity.findUnique({
    where: { id: opp.id },
    include: {
      offers: true,
      milestones: true,
    },
  });

  assert.ok(refreshedOpp);
  assert.equal(refreshedOpp.status, RescueStatus.ACCEPTED);
  assert.ok(refreshedOpp.acceptedOfferId);

  // The accepted offer must be marked ACCEPTED
  const winningOffer = refreshedOpp.offers.find((o) => o.id === refreshedOpp.acceptedOfferId);
  assert.ok(winningOffer);
  assert.equal(winningOffer.status, OfferStatus.ACCEPTED);

  // The competing offer must be marked REJECTED
  const losingOfferId = refreshedOpp.acceptedOfferId === offerA.id ? offerB.id : offerA.id;
  const losingOffer = refreshedOpp.offers.find((o) => o.id === losingOfferId);
  assert.ok(losingOffer);
  assert.equal(losingOffer.status, OfferStatus.REJECTED);

  // Exactly one OFFER_ACCEPTED milestone must exist
  const acceptMilestones = refreshedOpp.milestones.filter(
    (m) => m.milestoneType === "OFFER_ACCEPTED"
  );
  assert.equal(acceptMilestones.length, 1, "Exactly one OFFER_ACCEPTED milestone recorded");
});

test("Cargo Rescue Concurrency - Idempotent re-acceptance of the same winning offer", async () => {
  const fleetOrg = await prisma.organization.findUnique({
    where: { slug: "transcold-express" },
  });
  const partnerOrg = await prisma.organization.findUnique({
    where: { slug: "sahyadri-cold" },
  });
  const operator = await prisma.user.findUnique({
    where: { email: "operator@transcold.com" },
  });
  const partnerUser = await prisma.user.findUnique({
    where: { email: "director@sahyadricold.com" },
  });

  assert.ok(fleetOrg && partnerOrg && operator && partnerUser);

  const shipment = await prisma.shipment.create({
    data: {
      organizationId: fleetOrg.id,
      trackingNumber: `IDEMP-TEST-${Date.now().toString().slice(-6)}`,
      title: "Idempotency Cargo",
      cargoType: "Produce",
      tempMin: 4.0,
      tempMax: 10.0,
      originName: "Idemp Origin",
      destName: "Idemp Destination",
      status: "ALERTED",
    },
  });

  const opp = await createRescueOpportunity({
    organizationId: fleetOrg.id,
    shipmentId: shipment.id,
    title: "Idempotent Offer Acceptance Test",
    cargoDescription: "Testing idempotent retries on identical offer ID",
    cargoWeightKg: 500,
    tempRequirementMin: 4.0,
    tempRequirementMax: 10.0,
    actorId: operator.id,
  });

  const offer = await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 9000,
    capacityOfferedKg: 600,
    storageType: "COLD_STORAGE",
    estimatedEtaMinutes: 15,
  });

  // First acceptance
  const firstResult = await acceptRescueOffer({
    opportunityId: opp.id,
    offerId: offer.id,
    actorId: operator.id,
  });
  assert.equal(firstResult.idempotent, false);
  assert.equal(firstResult.offer?.status, OfferStatus.ACCEPTED);

  // Second acceptance of the exact same offer (e.g. network retry / duplicate click)
  const retryResult = await acceptRescueOffer({
    opportunityId: opp.id,
    offerId: offer.id,
    actorId: operator.id,
  });
  assert.equal(retryResult.idempotent, true);
  assert.equal(retryResult.offer?.status, OfferStatus.ACCEPTED);

  // Ensure only 1 milestone was created
  const milestones = await prisma.rescueMilestone.findMany({
    where: { opportunityId: opp.id, milestoneType: "OFFER_ACCEPTED" },
  });
  assert.equal(milestones.length, 1, "Duplicate accept call must not create duplicate milestones");
});
