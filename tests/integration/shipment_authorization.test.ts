import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/auth";
import {
  resolveActor,
  authorizeShipmentAccess,
  loadAuthorizedShipmentDetails,
  getShipmentsWhereClause,
  getRescueOpportunitiesWhereClause,
} from "../../src/lib/auth/policy";
import {
  createRescueOpportunity,
  submitRescueOffer,
  acceptRescueOffer,
} from "../../src/lib/rescue";
import { OrgType, UserRole } from "@prisma/client";

test("Shipment Authorization & Data Exposure - Comprehensive Isolation Policy", async () => {
  const ts = Date.now().toString().slice(-6);

  // 1. Setup Tenant A (Fleet A)
  const fleetA = await prisma.organization.create({
    data: {
      name: `Fleet Alpha ${ts}`,
      slug: `fleet-alpha-${ts}`,
      type: OrgType.FLEET,
    },
  });

  const passHash = await hashPassword("ComplexP@ssw0rd123!");

  const operatorAUser = await prisma.user.create({
    data: {
      email: `operator-a-${ts}@alpha.com`,
      name: `Operator Alpha ${ts}`,
      passwordHash: passHash,
      role: UserRole.OPERATOR,
      memberships: {
        create: { organizationId: fleetA.id, orgRole: "OWNER" },
      },
    },
  });

  const driverA1User = await prisma.user.create({
    data: {
      email: `driver-a1-${ts}@alpha.com`,
      name: `Driver Assigned ${ts}`,
      passwordHash: passHash,
      role: UserRole.DRIVER,
      memberships: {
        create: { organizationId: fleetA.id, orgRole: "DRIVER" },
      },
    },
  });

  const driverA2User = await prisma.user.create({
    data: {
      email: `driver-a2-${ts}@alpha.com`,
      name: `Driver Unassigned ${ts}`,
      passwordHash: passHash,
      role: UserRole.DRIVER,
      memberships: {
        create: { organizationId: fleetA.id, orgRole: "DRIVER" },
      },
    },
  });

  // Setup Device & Vehicle for Fleet A
  const deviceA = await prisma.device.create({
    data: {
      organizationId: fleetA.id,
      deviceIdentifier: `DEV-AUTH-${ts}`,
      apiKeyHash: "super_secret_sha256_device_hash_must_never_leak",
    },
  });

  // Create Shipment 1 for Fleet A (Assigned to driver A1)
  const shipmentA1 = await prisma.shipment.create({
    data: {
      organizationId: fleetA.id,
      trackingNumber: `APN-AUTH-A1-${ts}`,
      title: "Confidential Bio-Pharma Vaccine",
      cargoType: "Biologics",
      tempMin: 2.0,
      tempMax: 6.0,
      originName: "Mumbai Depot",
      destName: "Pune Central",
      assignedDeviceId: deviceA.id,
      assignedDriverId: driverA1User.id,
      status: "IN_TRANSIT",
    },
  });

  // 2. Setup Tenant B (Competitor Fleet B)
  const fleetB = await prisma.organization.create({
    data: {
      name: `Fleet Beta ${ts}`,
      slug: `fleet-beta-${ts}`,
      type: OrgType.FLEET,
    },
  });

  const operatorBUser = await prisma.user.create({
    data: {
      email: `operator-b-${ts}@beta.com`,
      name: `Operator Beta ${ts}`,
      passwordHash: passHash,
      role: UserRole.OPERATOR,
      memberships: {
        create: { organizationId: fleetB.id, orgRole: "OWNER" },
      },
    },
  });

  // 3. Setup Rescue Partner Orgs
  const partnerOrg1 = await prisma.organization.create({
    data: {
      name: `Cold Hub Partner 1 ${ts}`,
      slug: `partner-hub-1-${ts}`,
      type: OrgType.RESCUE_PARTNER,
    },
  });

  const partner1User = await prisma.user.create({
    data: {
      email: `partner1-${ts}@coldhub.com`,
      name: `Partner Candidate 1 ${ts}`,
      passwordHash: passHash,
      role: UserRole.PARTNER,
      memberships: {
        create: { organizationId: partnerOrg1.id, orgRole: "OWNER" },
      },
    },
  });

  await prisma.rescuePartnerProfile.create({
    data: {
      organizationId: partnerOrg1.id,
      facilityName: `Partner Hub 1 ${ts}`,
      capacityAvailableKg: 20000,
      tempRangeMin: -20,
      tempRangeMax: 10,
      contactEmail: partner1User.email,
      isActive: true,
      onboardingComplete: true,
    },
  });

  const partnerOrg2 = await prisma.organization.create({
    data: {
      name: `Cold Hub Partner 2 ${ts}`,
      slug: `partner-hub-2-${ts}`,
      type: OrgType.RESCUE_PARTNER,
    },
  });

  const partner2User = await prisma.user.create({
    data: {
      email: `partner2-${ts}@coldhub2.com`,
      name: `Partner Candidate 2 ${ts}`,
      passwordHash: passHash,
      role: UserRole.PARTNER,
      memberships: {
        create: { organizationId: partnerOrg2.id, orgRole: "OWNER" },
      },
    },
  });

  await prisma.rescuePartnerProfile.create({
    data: {
      organizationId: partnerOrg2.id,
      facilityName: `Partner Hub 2 ${ts}`,
      capacityAvailableKg: 20000,
      tempRangeMin: -20,
      tempRangeMax: 10,
      contactEmail: partner2User.email,
      isActive: true,
      onboardingComplete: true,
    },
  });

  // Unrelated Partner 3 (Has no rescue opportunities)
  const partnerOrg3 = await prisma.organization.create({
    data: {
      name: `Cold Hub Partner 3 ${ts}`,
      slug: `partner-hub-3-${ts}`,
      type: OrgType.RESCUE_PARTNER,
    },
  });

  const partner3User = await prisma.user.create({
    data: {
      email: `partner3-${ts}@coldhub3.com`,
      name: `Partner Unrelated 3 ${ts}`,
      passwordHash: passHash,
      role: UserRole.PARTNER,
      memberships: {
        create: { organizationId: partnerOrg3.id, orgRole: "OWNER" },
      },
    },
  });

  // User with NO organization membership
  const orphanUser = await prisma.user.create({
    data: {
      email: `orphan-${ts}@nobody.com`,
      name: `Orphan User ${ts}`,
      passwordHash: passHash,
      role: UserRole.OPERATOR,
    },
  });

  // Resolve Actors
  const actorOperatorA = (await resolveActor(operatorAUser.id))!;
  const actorDriverA1 = (await resolveActor(driverA1User.id))!;
  const actorDriverA2 = (await resolveActor(driverA2User.id))!;
  const actorOperatorB = (await resolveActor(operatorBUser.id))!;
  const actorPartner1 = (await resolveActor(partner1User.id))!;
  const actorPartner2 = (await resolveActor(partner2User.id))!;
  const actorPartner3 = (await resolveActor(partner3User.id))!;
  const actorOrphan = (await resolveActor(orphanUser.id))!;

  assert.ok(actorOperatorA && actorDriverA1 && actorDriverA2 && actorOperatorB && actorPartner1 && actorPartner2 && actorPartner3);

  // --- TEST CASE 1: Fleet Operator Access ---
  const opCheck = await authorizeShipmentAccess(actorOperatorA, shipmentA1.id);
  assert.equal(opCheck.allowed, true);
  assert.equal(opCheck.accessLevel, "FLEET_OPERATOR");

  // --- TEST CASE 2: Cross-Tenant Access is strictly DENIED ---
  const crossOrgCheck = await authorizeShipmentAccess(actorOperatorB, shipmentA1.id);
  assert.equal(crossOrgCheck.allowed, false);
  assert.equal(crossOrgCheck.reason, "CROSS_TENANT_FORBIDDEN");

  // --- TEST CASE 3: Assigned Driver vs Unassigned Driver in same Organization ---
  const assignedDriverCheck = await authorizeShipmentAccess(actorDriverA1, shipmentA1.id);
  assert.equal(assignedDriverCheck.allowed, true);
  assert.equal(assignedDriverCheck.accessLevel, "ASSIGNED_DRIVER");

  const unassignedDriverCheck = await authorizeShipmentAccess(actorDriverA2, shipmentA1.id);
  assert.equal(unassignedDriverCheck.allowed, false);
  assert.equal(unassignedDriverCheck.reason, "DRIVER_NOT_ASSIGNED_OR_CROSS_ORG");

  // --- TEST CASE 4: Partner cannot view shipment with NO rescue opportunity ---
  const partnerNoRescueCheck = await authorizeShipmentAccess(actorPartner1, shipmentA1.id);
  assert.equal(partnerNoRescueCheck.allowed, false);
  assert.equal(partnerNoRescueCheck.reason, "NO_RESCUE_OPPORTUNITY_FOR_PARTNER");

  // --- TEST CASE 5: Create Rescue Opportunity on Shipment A1 ---
  const opp = await createRescueOpportunity({
    organizationId: fleetA.id,
    shipmentId: shipmentA1.id,
    title: "Urgent Reefer Failure",
    cargoDescription: "Vaccines warming up",
    cargoWeightKg: 1200,
    tempRequirementMin: 2.0,
    tempRequirementMax: 6.0,
    maxBudget: 25000,
    actorId: operatorAUser.id,
  });

  // Now Partner 1 and Partner 2 can view in BIDDING mode
  const partner1BiddingCheck = await authorizeShipmentAccess(actorPartner1, shipmentA1.id);
  assert.equal(partner1BiddingCheck.allowed, true);
  assert.equal(partner1BiddingCheck.accessLevel, "RESCUE_PARTNER_BIDDING");

  // Submit competing bids
  const offer1 = await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg1.id,
    submittedById: partner1User.id,
    offerAmount: 18000,
    capacityOfferedKg: 2000,
    storageType: "COLD_STORAGE",
    estimatedEtaMinutes: 20,
    notes: "Offer 1 confidential bid notes",
  });

  await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg2.id,
    submittedById: partner2User.id,
    offerAmount: 22000,
    capacityOfferedKg: 2500,
    storageType: "EMERGENCY_REEFER",
    estimatedEtaMinutes: 30,
    notes: "Offer 2 confidential bid notes",
  });

  // --- TEST CASE 6: Verify Safe Projection & Competitor Isolation during Bidding ---
  const partner1Details = await loadAuthorizedShipmentDetails(actorPartner1, shipmentA1.id);
  assert.ok(partner1Details.shipment);

  // Critical: Device apiKeyHash must NEVER be present!
  assert.equal((partner1Details.shipment as any).assignedDevice, null);

  // Critical: Partner 1 can ONLY see Offer 1, NEVER Offer 2!
  const partner1VisibleOffers = partner1Details.shipment.rescueOpportunity?.offers;
  assert.equal(partner1VisibleOffers?.length, 1);
  assert.equal(partner1VisibleOffers?.[0].id, offer1.id);
  assert.equal(partner1VisibleOffers?.[0].partnerOrgId, partnerOrg1.id);

  // Critical: maxBudget must be redacted from partner!
  assert.equal(partner1Details.shipment.rescueOpportunity?.maxBudget, null);

  // --- TEST CASE 7: Operator Accepts Offer 1 (Partner 1 wins, Partner 2 loses) ---
  await acceptRescueOffer({
    opportunityId: opp.id,
    offerId: offer1.id,
    actorId: operatorAUser.id,
  });

  // Now Partner 1 has ASSIGNED status
  const partner1AssignedCheck = await authorizeShipmentAccess(actorPartner1, shipmentA1.id);
  assert.equal(partner1AssignedCheck.allowed, true);
  assert.equal(partner1AssignedCheck.accessLevel, "RESCUE_PARTNER_ASSIGNED");

  // Losing Partner 2 can no longer access the assigned shipment!
  const partner2LosingCheck = await authorizeShipmentAccess(actorPartner2, shipmentA1.id);
  assert.equal(partner2LosingCheck.allowed, false);
  assert.equal(partner2LosingCheck.reason, "PARTNER_UNAUTHORIZED_FOR_COMPLETED_OR_UNASSIGNED_RESCUE");

  // Unrelated Partner 3 is completely blocked
  const partner3BlockedCheck = await authorizeShipmentAccess(actorPartner3, shipmentA1.id);
  assert.equal(partner3BlockedCheck.allowed, false);

  // --- TEST CASE 8: Zero Credential Leakage in Operator & Driver Details ---
  const operatorDetails = await loadAuthorizedShipmentDetails(actorOperatorA, shipmentA1.id);
  const jsonStr = JSON.stringify(operatorDetails);
  assert.equal(jsonStr.includes("passwordHash"), false, "JSON payload must NEVER contain passwordHash");
  assert.equal(jsonStr.includes("apiKeyHash"), false, "JSON payload must NEVER contain apiKeyHash");
  assert.equal(jsonStr.includes("super_secret_sha256_device_hash"), false);

  const driverDetails = await loadAuthorizedShipmentDetails(actorDriverA1, shipmentA1.id);
  const driverJsonStr = JSON.stringify(driverDetails);
  assert.equal(driverJsonStr.includes("passwordHash"), false);
  assert.equal(driverJsonStr.includes("apiKeyHash"), false);
  // Driver does not see financial competitor offers
  assert.equal(driverDetails.shipment.rescueOpportunity?.offers.length, 0);

  // --- TEST CASE 9: Failsafe Where-Clause Query Builders ---
  // User with no organization fails closed
  const orphanWhere = getShipmentsWhereClause(actorOrphan);
  assert.deepEqual(orphanWhere, { id: "FAIL_CLOSED_NO_ACCESS" });

  const orphanOppWhere = getRescueOpportunitiesWhereClause(actorOrphan);
  assert.deepEqual(orphanOppWhere, { id: "FAIL_CLOSED_NO_ACCESS" });

  // Driver where-clause is strictly constrained to primaryOrgId AND assignedDriverId
  const driverWhere = getShipmentsWhereClause(actorDriverA1);
  assert.deepEqual(driverWhere, {
    organizationId: fleetA.id,
    assignedDriverId: driverA1User.id,
  });
});
