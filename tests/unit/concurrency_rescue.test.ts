import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import {
  createRescueOpportunity,
  submitRescueOffer,
  acceptRescueOffer,
} from "../../src/lib/rescue";
import { OfferStatus, RescueStatus } from "@prisma/client";

test("Cargo Rescue Concurrency - Single accepted offer guarantees mutual exclusion", async () => {
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

  // Create test shipment for concurrency test
  const shipment = await prisma.shipment.create({
    data: {
      organizationId: fleetOrg.id,
      trackingNumber: `CONCUR-TEST-${Date.now().toString().slice(-6)}`,
      title: "Concurrency Stress Test Cargo",
      cargoType: "Dairy",
      tempMin: 2.0,
      tempMax: 6.0,
      originName: "Origin Test",
      destName: "Dest Test",
      status: "ALERTED",
    },
  });

  // Create rescue opportunity
  const opp = await createRescueOpportunity({
    organizationId: fleetOrg.id,
    shipmentId: shipment.id,
    title: "Concurrent Offer Rescue",
    cargoDescription: "Stress testing offer acceptance locks",
    cargoWeightKg: 1000,
    tempRequirementMin: 2.0,
    tempRequirementMax: 6.0,
    actorId: operator.id,
  });

  // Submit Offer 1
  const offer1 = await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 12000,
    capacityOfferedKg: 2000,
    storageType: "COLD_STORAGE",
    estimatedEtaMinutes: 20,
  });

  // Submit Offer 2
  const offer2 = await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 14000,
    capacityOfferedKg: 2000,
    storageType: "EMERGENCY_REEFER",
    estimatedEtaMinutes: 30,
  });

  // Accept Offer 1
  const result1 = await acceptRescueOffer({
    opportunityId: opp.id,
    offerId: offer1.id,
    actorId: operator.id,
  });
  assert.ok(result1.offer);
  assert.equal(result1.offer.status, OfferStatus.ACCEPTED);
  assert.equal(result1.opportunity.status, RescueStatus.ACCEPTED);

  // Attempting to accept Offer 2 must be rejected!
  await assert.rejects(
    async () => {
      await acceptRescueOffer({
        opportunityId: opp.id,
        offerId: offer2.id,
        actorId: operator.id,
      });
    },
    /cannot accept offers|already been accepted/,
    "Second acceptance must fail due to single-winner invariant"
  );

  // Offer 2 should now be marked REJECTED in database
  const refreshedOffer2 = await prisma.rescueOffer.findUnique({
    where: { id: offer2.id },
  });
  assert.equal(refreshedOffer2?.status, OfferStatus.REJECTED);
});
