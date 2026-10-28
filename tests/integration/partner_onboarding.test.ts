import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/auth";
import {
  createRescueOpportunity,
  submitRescueOffer,
} from "../../src/lib/rescue";
import { OrgType, UserRole } from "@prisma/client";

test("Partner Onboarding - Real onboarding lifecycle and bid qualification invariant", async () => {
  const fleetOrg = await prisma.organization.findUnique({
    where: { slug: "transcold-express" },
  });
  const operator = await prisma.user.findUnique({
    where: { email: "operator@transcold.com" },
  });
  assert.ok(fleetOrg && operator);

  // 1. Create a brand new unverified partner account
  const timestamp = Date.now().toString().slice(-6);
  const partnerEmail = `partner-${timestamp}@example.com`;
  const passwordHash = await hashPassword("ComplexP@ssw0rd123!");

  const partnerUser = await prisma.user.create({
    data: {
      email: partnerEmail,
      name: `Partner Candidate ${timestamp}`,
      passwordHash,
      role: UserRole.PARTNER,
    },
  });

  const partnerOrg = await prisma.organization.create({
    data: {
      name: `Fresh Valley Cold Logistics ${timestamp}`,
      slug: `fresh-valley-${timestamp}`,
      type: OrgType.RESCUE_PARTNER,
      memberships: {
        create: {
          userId: partnerUser.id,
          orgRole: "OWNER",
        },
      },
    },
  });

  // Partner profile initialized at registration without fabricated details
  const initialProfile = await prisma.rescuePartnerProfile.create({
    data: {
      organizationId: partnerOrg.id,
      facilityName: `${partnerOrg.name} Facility`,
      facilityType: "COLD_STORAGE",
      address: null,
      latitude: null,
      longitude: null,
      capacityAvailableKg: null,
      tempRangeMin: null,
      tempRangeMax: null,
      contactEmail: partnerUser.email,
      contactPhone: null,
      isActive: false,
      onboardingComplete: false,
      verificationStatus: "UNVERIFIED_SELF_REPORTED",
    },
  });

  assert.equal(initialProfile.onboardingComplete, false);
  assert.equal(initialProfile.isActive, false);
  assert.equal(initialProfile.capacityAvailableKg, null);

  // 2. Setup an active rescue opportunity
  const shipment = await prisma.shipment.create({
    data: {
      organizationId: fleetOrg.id,
      trackingNumber: `ONBOARD-TEST-${timestamp}`,
      title: "Onboarding Invariant Test Cargo",
      cargoType: "Dairy",
      tempMin: 2.0,
      tempMax: 6.0,
      originName: "Origin A",
      destName: "Dest B",
      status: "ALERTED",
    },
  });

  const opp = await createRescueOpportunity({
    organizationId: fleetOrg.id,
    shipmentId: shipment.id,
    title: "Onboarding Gate Test Opportunity",
    cargoDescription: "Testing partner qualification gates",
    cargoWeightKg: 1500,
    tempRequirementMin: 2.0,
    tempRequirementMax: 6.0,
    actorId: operator.id,
  });

  // 3. Attempting to submit offer without completing onboarding must be rejected
  await assert.rejects(
    async () => {
      await submitRescueOffer({
        opportunityId: opp.id,
        partnerOrgId: partnerOrg.id,
        submittedById: partnerUser.id,
        offerAmount: 20000,
        capacityOfferedKg: 2000,
        storageType: "COLD_STORAGE",
        estimatedEtaMinutes: 30,
      });
    },
    /PARTNER_ONBOARDING_INCOMPLETE/,
    "Unverified partner without completed onboarding must be prevented from submitting rescue offers"
  );

  // 4. Partner completes onboarding with verified facility details
  const completedProfile = await prisma.rescuePartnerProfile.update({
    where: { organizationId: partnerOrg.id },
    data: {
      facilityName: "Fresh Valley Talegaon Logistics Park",
      facilityType: "COLD_STORAGE",
      address: "Plot 42, Talegaon Industrial Area, Pune 410507",
      latitude: 18.734,
      longitude: 73.678,
      capacityAvailableKg: 35000,
      tempRangeMin: -25.0,
      tempRangeMax: 8.0,
      contactPhone: "+91-2114-290000",
      contactEmail: partnerUser.email,
      isActive: true,
      onboardingComplete: true,
      verificationStatus: "SELF_REPORTED_VERIFIED_LOCATION",
    },
  });

  assert.equal(completedProfile.onboardingComplete, true);
  assert.equal(completedProfile.isActive, true);
  assert.equal(completedProfile.capacityAvailableKg, 35000);

  // 5. Now that onboarding is complete, offer submission succeeds
  const offer = await submitRescueOffer({
    opportunityId: opp.id,
    partnerOrgId: partnerOrg.id,
    submittedById: partnerUser.id,
    offerAmount: 18500,
    capacityOfferedKg: 2500,
    storageType: "COLD_STORAGE",
    estimatedEtaMinutes: 25,
    notes: "Verified pre-cooled bay active and ready for transfer.",
  });

  assert.ok(offer.id);
  assert.equal(offer.status, "SUBMITTED");
  assert.equal(offer.offerAmount, 18500);
});
