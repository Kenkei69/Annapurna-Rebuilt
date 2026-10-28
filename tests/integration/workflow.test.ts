import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import { provisionDevice, createVehicle } from "../../src/lib/fleet";
import { createShipment } from "../../src/lib/shipments";
import { ingestTelemetryReading } from "../../src/lib/telemetry";
import { acknowledgeAlert } from "../../src/lib/alerts";
import {
  createRescueOpportunity,
  submitRescueOffer,
  acceptRescueOffer,
  recordRescueMilestone,
  completeRescue,
} from "../../src/lib/rescue";
import { assertOrgAccess } from "../../src/lib/org";
import { ShipmentStatus, AlertStatus, OfferStatus, RescueStatus, UserRole } from "@prisma/client";

test("Integration Workflow: Complete End-to-End Operator -> Telemetry -> Alert -> Rescue Journey", async () => {
  // 1. Fetch seeded organizations and users
  const fleetOrg = await prisma.organization.findUnique({
    where: { slug: "transcold-express" },
  });
  assert.ok(fleetOrg, "Seeded fleet organization must exist");

  const operator = await prisma.user.findUnique({
    where: { email: "operator@transcold.com" },
  });
  assert.ok(operator, "Seeded operator user must exist");

  const partnerOrg = await prisma.organization.findUnique({
    where: { slug: "sahyadri-cold" },
  });
  assert.ok(partnerOrg, "Seeded partner organization must exist");

  const partnerUser = await prisma.user.findUnique({
    where: { email: "director@sahyadricold.com" },
  });
  assert.ok(partnerUser, "Seeded partner user must exist");

  const competitorOrg = await prisma.organization.findUnique({
    where: { slug: "coastal-reefer" },
  });
  assert.ok(competitorOrg, "Seeded competitor organization must exist");

  // 2. Step 1: Provision Vehicle and Device
  const vehicle = await createVehicle({
    organizationId: fleetOrg.id,
    licensePlate: `TEST-REEFER-${Date.now().toString().slice(-4)}`,
    makeModel: "Volvo FE Electric Reefer",
    tempCapabilityMin: -25.0,
    tempCapabilityMax: 10.0,
    actorId: operator.id,
    actorEmail: operator.email,
  });
  assert.ok(vehicle.id);

  const deviceIdentifier = `DEVICE-TEST-${Date.now().toString().slice(-6)}`;
  const { device, plainApiKey } = await provisionDevice({
    organizationId: fleetOrg.id,
    deviceIdentifier,
    hardwareModel: "ANNAPURNA-EDGE-S3",
    actorId: operator.id,
    actorEmail: operator.email,
  });
  assert.ok(device.id);
  assert.ok(plainApiKey.startsWith("dev_key_"));

  // 3. Step 2: Create Shipment
  const shipment = await createShipment({
    organizationId: fleetOrg.id,
    title: "Vaccines & Biologics Express",
    cargoType: "Pharmaceuticals",
    tempMin: 2.0,
    tempMax: 6.0,
    humidityMin: 40.0,
    humidityMax: 70.0,
    originName: "Serum Bio Hub, Pune",
    destName: "Central Pharma Terminal, Mumbai",
    assignedVehicleId: vehicle.id,
    assignedDeviceId: device.id,
    actorId: operator.id,
    actorEmail: operator.email,
  });
  assert.ok(shipment.id);
  assert.equal(shipment.status, ShipmentStatus.DISPATCHED);

  // 4. Step 3: Simulator sends Normal Telemetry -> transitions to IN_TRANSIT
  const normalRes = await ingestTelemetryReading({
    deviceId: device.deviceIdentifier,
    sequence: 1,
    recordedAt: new Date(Date.now() - 60000).toISOString(),
    temperature: 3.5,
    humidity: 50.0,
    isSimulated: true,
  });
  assert.equal(normalRes.status, "accepted");

  const updatedAfterNormal = await prisma.shipment.findUnique({
    where: { id: shipment.id },
  });
  assert.equal(updatedAfterNormal?.status, ShipmentStatus.IN_TRANSIT);
  assert.equal(updatedAfterNormal?.latestTemperature, 3.5);

  // 5. Step 4: Test Telemetry Deduplication / Replay Protection
  const dupRes = await ingestTelemetryReading({
    deviceId: device.deviceIdentifier,
    sequence: 1, // Repeat sequence 1
    recordedAt: new Date().toISOString(),
    temperature: 3.5,
    isSimulated: true,
  });
  assert.equal(dupRes.status, "duplicate_ignored");
  assert.equal(dupRes.deduplicated, true);

  // 6. Step 5: Simulator sends Warming Breach -> Generates Alert and moves to ALERTED
  const breach1 = await ingestTelemetryReading({
    deviceId: device.deviceIdentifier,
    sequence: 2,
    recordedAt: new Date(Date.now() - 40000).toISOString(),
    temperature: 7.5, // exceeds 6.0°C
    isSimulated: true,
  });
  assert.ok((breach1.triggeredAlertsCount ?? 0) >= 1);

  const alertedShipment = await prisma.shipment.findUnique({
    where: { id: shipment.id },
    include: { alerts: true },
  });
  assert.equal(alertedShipment?.status, ShipmentStatus.ALERTED);
  assert.ok(alertedShipment?.alerts.length >= 1);

  const activeAlert = alertedShipment.alerts.find((a) => a.status === AlertStatus.ACTIVE);
  assert.ok(activeAlert);
  assert.equal(activeAlert.ruleCode, "TEMP_HIGH_BREACH");

  // 7. Step 6: Operator Acknowledges Incident
  const ackedAlert = await acknowledgeAlert({
    alertId: activeAlert.id,
    actorId: operator.id,
    actorEmail: operator.email,
    notes: "Driver contacted; compressor motor tripped. Preparing rescue transfer.",
  });
  assert.equal(ackedAlert.status, AlertStatus.ACKNOWLEDGED);

  // 8. Step 7: Create Cargo Rescue Opportunity
  const opportunity = await createRescueOpportunity({
    organizationId: fleetOrg.id,
    shipmentId: shipment.id,
    title: "Urgent Pharma Cargo Cold Transfer",
    cargoDescription: "Temperature-sensitive vaccines requiring 2-6°C storage",
    cargoWeightKg: 1200,
    tempRequirementMin: 2.0,
    tempRequirementMax: 6.0,
    urgency: "HIGH",
    maxBudget: 25000,
    actorId: operator.id,
    actorEmail: operator.email,
  });
  assert.equal(opportunity.status, RescueStatus.OPEN);

  // 9. Step 8: Partner submits Offer 1
  const winningOffer = await submitRescueOffer({
    opportunityId: opportunity.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 18000,
    capacityOfferedKg: 5000,
    storageType: "REFRIGERATED_WAREHOUSE",
    estimatedEtaMinutes: 25,
    notes: "Facility ready with pre-cooled intake bay.",
  });
  assert.equal(winningOffer.status, OfferStatus.SUBMITTED);

  // Competing Partner submits Offer 2
  const competingOffer = await submitRescueOffer({
    opportunityId: opportunity.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 22000,
    capacityOfferedKg: 3000,
    storageType: "BACKUP_REEFER",
    estimatedEtaMinutes: 45,
    notes: "Secondary response unit.",
  });
  assert.equal(competingOffer.status, OfferStatus.SUBMITTED);

  // 10. Step 9: Transaction-Safe Offer Acceptance
  const acceptResult = await acceptRescueOffer({
    opportunityId: opportunity.id,
    offerId: winningOffer.id,
    actorId: operator.id,
    actorEmail: operator.email,
  });
  assert.ok(acceptResult.offer);
  assert.equal(acceptResult.offer.status, OfferStatus.ACCEPTED);
  assert.equal(acceptResult.opportunity.status, RescueStatus.ACCEPTED);
  assert.equal(acceptResult.opportunity.acceptedOfferId, winningOffer.id);

  // Verify competing offer was automatically marked REJECTED
  const refreshedCompeting = await prisma.rescueOffer.findUnique({
    where: { id: competingOffer.id },
  });
  assert.equal(refreshedCompeting?.status, OfferStatus.REJECTED);

  // 11. Step 10: Milestones & Rescue Completion
  await recordRescueMilestone({
    opportunityId: opportunity.id,
    actorId: partnerUser.id,
    milestoneType: "TRANSFER_DISPATCHED",
    notes: "Reefer team arrived at incident location. Cargo safely transferred into partner vehicle.",
  });

  const completedOpp = await completeRescue({
    opportunityId: opportunity.id,
    actorId: operator.id,
    actorEmail: operator.email,
    outcomeNotes: "All 1,200 kg vaccines verified intact at 3.8°C upon arrival at Sahyadri Depot.",
  });
  assert.equal(completedOpp.status, RescueStatus.COMPLETED);

  const finalShipment = await prisma.shipment.findUnique({
    where: { id: shipment.id },
  });
  assert.equal(finalShipment?.status, ShipmentStatus.RESCUED);

  // 12. Step 11: Audit Trail Verification
  const auditLogs = await prisma.auditEvent.findMany({
    where: { organizationId: fleetOrg.id },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(auditLogs.length >= 5);
  const actions = auditLogs.map((a) => a.action);
  assert.ok(actions.includes("SHIPMENT_CREATED"));
  assert.ok(actions.includes("ALERT_ACKNOWLEDGED"));
  assert.ok(actions.includes("RESCUE_OPPORTUNITY_CREATED"));
  assert.ok(actions.includes("RESCUE_OFFER_ACCEPTED"));
  assert.ok(actions.includes("RESCUE_COMPLETED"));

  // 13. Step 12: Tenant Isolation Verification
  // The competitor organization must NOT have access to fleetOrg's data
  await assert.rejects(
    async () => {
      await assertOrgAccess(operator.id, UserRole.OPERATOR, competitorOrg.id);
    },
    /ORG_ACCESS_DENIED/,
    "Operator from fleetOrg must be strictly blocked from competitor organization"
  );
});
