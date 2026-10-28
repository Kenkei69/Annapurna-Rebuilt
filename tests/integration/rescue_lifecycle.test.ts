import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import {
  acceptRescueOffer,
  completeRescue,
  createRescueOpportunity,
  recordRescueMilestone,
  submitRescueOffer,
} from "../../src/lib/rescue";
import { createVehicle, provisionDevice } from "../../src/lib/fleet";
import { createShipment } from "../../src/lib/shipments";
import { OfferStatus, RescueStatus, ShipmentStatus } from "@prisma/client";

test("Priority 4: Rescue Lifecycle, Suitability Validation, Expiry Persistence & Atomic Completion", async () => {
  const fleetOrg = await prisma.organization.findUnique({
    where: { slug: "transcold-express" },
  });
  assert.ok(fleetOrg);

  const operator = await prisma.user.findUnique({
    where: { email: "operator@transcold.com" },
  });
  assert.ok(operator);

  const partnerOrg = await prisma.organization.findUnique({
    where: { slug: "sahyadri-cold" },
    include: { partnerProfile: true },
  });
  assert.ok(partnerOrg && partnerOrg.partnerProfile);

  const partnerUser = await prisma.user.findUnique({
    where: { email: "director@sahyadricold.com" },
  });
  assert.ok(partnerUser);

  // 1. Provision vehicle and device, create shipment and opportunity
  const vehicle = await createVehicle({
    organizationId: fleetOrg.id,
    licensePlate: `RESCUE-V-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    makeModel: "Tata Ultra Reefer",
    actorId: operator.id,
  });

  const { device } = await provisionDevice({
    organizationId: fleetOrg.id,
    deviceIdentifier: `DEV-RESCUE-${Date.now().toString().slice(-6)}`,
    hardwareModel: "ANNAPURNA-EDGE-S3",
  });

  const shipment = await createShipment({
    organizationId: fleetOrg.id,
    title: "Vaccine Emergency Rescue Run",
    cargoType: "Biologics",
    tempMin: 2.0,
    tempMax: 6.0,
    originName: "Serum Institute",
    destName: "Regional Hospital",
    assignedDeviceId: device.id,
    assignedVehicleId: vehicle.id,
    actorId: operator.id,
  });

  // Manually update shipment to ALERTED so it's eligible for rescue creation
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: { status: ShipmentStatus.ALERTED },
  });

  const opp = await createRescueOpportunity({
    organizationId: fleetOrg.id,
    shipmentId: shipment.id,
    title: "Cold Chain Compromise - Urgent Reefer Required",
    cargoDescription: "Vaccine Pallets (3500 kg)",
    cargoWeightKg: 3500, // 3500 kg cargo
    tempRequirementMin: 2.0,
    tempRequirementMax: 6.0,
    actorId: operator.id,
  });
  assert.ok(opp.id);
  assert.equal(opp.status, RescueStatus.OPEN);

  // 2. Test Suitability: Offer with Insufficient Capacity (offer 2000 kg < cargo 3500 kg)
  const lowCapacityOffer = await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 15000,
    capacityOfferedKg: 2000, // Insufficient!
    storageType: "COLD_STORAGE",
    estimatedEtaMinutes: 25,
  });

  await assert.rejects(
    async () => {
      await acceptRescueOffer({
        opportunityId: opp.id,
        offerId: lowCapacityOffer.id,
        actorId: operator.id,
      });
    },
    /INSUFFICIENT_CAPACITY/,
    "Offer with capacity below cargo weight must be rejected"
  );

  // 3. Test Offer Expiration: Expired offer is marked EXPIRED cleanly without rollback
  const expiredOffer = await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 18000,
    capacityOfferedKg: 4000,
    storageType: "COLD_STORAGE",
    estimatedEtaMinutes: 20,
    validUntilHours: 1,
  });

  // Manually backdate validUntil into the past
  await prisma.rescueOffer.update({
    where: { id: expiredOffer.id },
    data: { validUntil: new Date(Date.now() - 3600000) },
  });

  await assert.rejects(
    async () => {
      await acceptRescueOffer({
        opportunityId: opp.id,
        offerId: expiredOffer.id,
        actorId: operator.id,
      });
    },
    /OFFER_EXPIRED/,
    "Accepting an expired offer must throw OFFER_EXPIRED"
  );

  // Verify that the offer in the database was persisted with status = EXPIRED
  const refreshedExpiredOffer = await prisma.rescueOffer.findUnique({
    where: { id: expiredOffer.id },
  });
  assert.equal(
    refreshedExpiredOffer?.status,
    OfferStatus.EXPIRED,
    "Expired offer status must be cleanly persisted as EXPIRED in the database"
  );

  // 4. Test Valid Suitable Offer Acceptance
  const validOffer = await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 20000,
    capacityOfferedKg: 5000, // > 3500 kg
    storageType: "COLD_STORAGE",
    estimatedEtaMinutes: 30,
    validUntilHours: 12,
  });

  const acceptResult = await acceptRescueOffer({
    opportunityId: opp.id,
    offerId: validOffer.id,
    actorId: operator.id,
  });
  assert.equal(acceptResult.opportunity.status, RescueStatus.ACCEPTED);
  assert.ok(acceptResult.offer);
  assert.equal(acceptResult.offer.status, OfferStatus.ACCEPTED);

  // 5. Milestones Progression (Locked & Validated)
  const milestone1 = await recordRescueMilestone({
    opportunityId: opp.id,
    actorId: partnerUser.id,
    milestoneType: "EN_ROUTE_TO_CARGO",
    notes: "Backup reefer dispatch en-route to scene",
  });
  assert.ok(milestone1.id);

  const oppAfterM1 = await prisma.rescueOpportunity.findUnique({
    where: { id: opp.id },
  });
  assert.equal(oppAfterM1?.status, RescueStatus.IN_PROGRESS);

  // 6. Complete Rescue: Atomically transitions opportunity to COMPLETED and shipment to RESCUED
  const completedOpp = await completeRescue({
    opportunityId: opp.id,
    actorId: operator.id,
    outcomeNotes: "Cargo safely cross-docked into Sahyadri Cold Hub chamber 4 at 3.8°C",
  });
  assert.equal(completedOpp.status, RescueStatus.COMPLETED);

  const finalizedShipment = await prisma.shipment.findUnique({
    where: { id: shipment.id },
  });
  assert.equal(
    finalizedShipment?.status,
    ShipmentStatus.RESCUED,
    "Shipment must be atomically transitioned to RESCUED on rescue completion"
  );
});
