import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import { GET as getDevices } from "../../src/app/api/devices/route";
import { POST as createShipmentRoute } from "../../src/app/api/shipments/route";
import { POST as uploadPhoto } from "../../src/app/api/shipments/[id]/photos/route";
import { GET as getSinglePhoto } from "../../src/app/api/shipments/[id]/photos/[photoId]/route";
import { POST as submitCounterRoute } from "../../src/app/api/rescue/opportunities/[id]/offers/[offerId]/counter/route";
import { POST as respondCounterRoute } from "../../src/app/api/rescue/opportunities/[id]/offers/[offerId]/counter-response/route";
import { POST as analyzeIncidentRoute } from "../../src/app/api/ai/analyze-incident/route";
import { provisionDevice } from "../../src/lib/fleet";
import { createRescueOpportunity, submitRescueOffer, acceptRescueOffer } from "../../src/lib/rescue";
import { hashPassword, createSessionToken, authCookieConfig } from "../../src/lib/auth";
import { UserRole, OrgType, OrgMemberRole, FacilityType } from "@prisma/client";

function makeAuthRequest(
  method: string,
  url: string,
  user: { id: string; email: string; role: UserRole },
  body?: unknown,
  extraHeaders?: Record<string, string>
): Request {
  const token = createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  const headers = new Headers({
    cookie: `${authCookieConfig.name}=${token}`,
    "content-type": "application/json",
    ...extraHeaders,
  });

  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// 1x1 transparent PNG data URL for test upload
// PNG signature + IHDR (width: 100, height: 100)
function createTestPngDataUrl(width = 100, height = 100): string {
  const buf = Buffer.alloc(33);
  // PNG Magic Bytes
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  // IHDR chunk length: 13
  buf.writeUInt32BE(13, 8);
  // "IHDR"
  buf.write("IHDR", 12, "ascii");
  // Width & Height
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8; // bit depth
  buf[25] = 6; // RGBA
  buf[26] = 0;
  buf[27] = 0;
  buf[28] = 0;

  return `data:image/png;base64,${buf.toString("base64")}`;
}

test("Advanced Workflows: Credential Projection, Cargo Photos, Counter-Offers & Advisory AI", async (t) => {
  const testId = `adv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await hashPassword("SecretP@ssw0rd123!");

  // 1. Provision Fleet Org & Users
  const fleetOrg = await prisma.organization.create({
    data: {
      name: `Fleet ${testId}`,
      slug: `fleet-${testId}`,
      type: OrgType.FLEET,
    },
  });

  const fleetOwner = await prisma.user.create({
    data: {
      email: `owner-${testId}@fleet.local`,
      passwordHash,
      name: "Fleet Owner",
      role: UserRole.OPERATOR,
      memberships: {
        create: { organizationId: fleetOrg.id, orgRole: OrgMemberRole.OWNER },
      },
    },
  });

  const fleetDriver = await prisma.user.create({
    data: {
      email: `driver-${testId}@fleet.local`,
      passwordHash,
      name: "Assigned Driver",
      role: UserRole.DRIVER,
      memberships: {
        create: { organizationId: fleetOrg.id, orgRole: OrgMemberRole.DRIVER },
      },
    },
  });

  // 2. Provision Partner Org & User
  const partnerOrg = await prisma.organization.create({
    data: {
      name: `Rescue Partner ${testId}`,
      slug: `partner-${testId}`,
      type: OrgType.RESCUE_PARTNER,
      partnerProfile: {
        create: {
          facilityName: `SafeCold Hub ${testId}`,
          facilityType: FacilityType.COLD_STORAGE,
          capacityAvailableKg: 10000,
          tempRangeMin: -10,
          tempRangeMax: 15,
          contactEmail: `partner-${testId}@safehub.local`,
          onboardingComplete: true,
          isActive: true,
        },
      },
    },
  });

  const partnerDispatcher = await prisma.user.create({
    data: {
      email: `dispatcher-${testId}@partner.local`,
      passwordHash,
      name: "Partner Dispatcher",
      role: UserRole.PARTNER,
      memberships: {
        create: { organizationId: partnerOrg.id, orgRole: OrgMemberRole.DISPATCHER },
      },
    },
  });

  // 3. Foreign / Unrelated Org & User (for cross-tenant checks)
  const intruderOrg = await prisma.organization.create({
    data: {
      name: `Intruder ${testId}`,
      slug: `intruder-${testId}`,
      type: OrgType.FLEET,
    },
  });

  const intruderUser = await prisma.user.create({
    data: {
      email: `intruder-${testId}@outside.local`,
      passwordHash,
      name: "Intruder User",
      role: UserRole.OPERATOR,
      memberships: {
        create: { organizationId: intruderOrg.id, orgRole: OrgMemberRole.MEMBER },
      },
    },
  });

  // --------------------------------------------------------------------------
  // Check A: Device Credential Projection Fix
  // --------------------------------------------------------------------------
  await t.test("Device credential projection strictly excludes apiKeyHash", async () => {
    // 1. Provision device
    const provisionResult = await provisionDevice({
      organizationId: fleetOrg.id,
      deviceIdentifier: `DEV-PRJ-${testId}`,
      hardwareModel: "ANNAPURNA-EDGE-S3",
      actorId: fleetOwner.id,
    });

    assert.ok(provisionResult.plainApiKey, "Plain API key must be returned at provisioning time");
    assert.strictEqual(
      (provisionResult.device as any).apiKeyHash,
      undefined,
      "apiKeyHash must be strictly stripped from provisioned device DTO"
    );

    // 2. Query GET /api/devices as Fleet Owner
    const req = makeAuthRequest("GET", "http://localhost:3000/api/devices", fleetOwner);
    const res = await getDevices(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.devices));
    for (const dev of body.devices) {
      assert.strictEqual(dev.apiKeyHash, undefined, "apiKeyHash must never leak in GET /api/devices");
    }
  });

  // --------------------------------------------------------------------------
  // Check B: Shipment Cargo Weight & Persistence
  // --------------------------------------------------------------------------
  let testShipmentId: string;
  await t.test("Shipment creation persists cargoWeightKg and bounds properly", async () => {
    const req = makeAuthRequest("POST", "http://localhost:3000/api/shipments", fleetOwner, {
      title: `Vaccines Batch ${testId}`,
      cargoType: "Biologics",
      cargoWeightKg: 4200,
      tempMin: 2.0,
      tempMax: 8.0,
      originName: "Hyderabad Biotech Hub",
      destName: "Bangalore Central Depot",
      assignedDriverId: fleetDriver.id,
    });

    const res = await createShipmentRoute(req);
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.shipment?.id);
    assert.strictEqual(body.shipment.cargoWeightKg, 4200);
    testShipmentId = body.shipment.id;
  });

  // --------------------------------------------------------------------------
  // Check C: Private Cargo-Photo Storage & Tenant Isolation
  // --------------------------------------------------------------------------
  let testPhotoId: string;
  await t.test("Private cargo photo upload, validation, and access isolation", async () => {
    const pngDataUrl = createTestPngDataUrl(250, 150);

    // 1. Upload photo as authorized Driver
    const uploadReq = makeAuthRequest(
      "POST",
      `http://localhost:3000/api/shipments/${testShipmentId}/photos`,
      fleetDriver,
      {
        dataUrl: pngDataUrl,
        fileName: "cargo-door-check.png",
        caption: "Physical seal inspection at departure gate.",
      }
    );

    const uploadRes = await uploadPhoto(uploadReq, {
      params: Promise.resolve({ id: testShipmentId }),
    });

    assert.strictEqual(uploadRes.status, 201);
    const uploadBody = await uploadRes.json();
    assert.ok(uploadBody.photo?.id);
    assert.strictEqual(uploadBody.photo.mimeType, "image/png");
    assert.strictEqual(uploadBody.photo.widthPx, 250);
    assert.strictEqual(uploadBody.photo.heightPx, 150);
    testPhotoId = uploadBody.photo.id;

    // 2. Reject non-image / corrupted payloads
    const invalidReq = makeAuthRequest(
      "POST",
      `http://localhost:3000/api/shipments/${testShipmentId}/photos`,
      fleetDriver,
      {
        dataUrl: "data:image/png;base64,bm90YW5pbWFnZQ==", // "notanimage"
        fileName: "fake.png",
      }
    );
    const invalidRes = await uploadPhoto(invalidReq, {
      params: Promise.resolve({ id: testShipmentId }),
    });
    assert.strictEqual(invalidRes.status, 400);

    // 3. Authorized retrieval by Fleet Owner (200 OK with private cache headers)
    const readReq = makeAuthRequest(
      "GET",
      `http://localhost:3000/api/shipments/${testShipmentId}/photos/${testPhotoId}`,
      fleetOwner
    );
    const readRes = await getSinglePhoto(readReq, {
      params: Promise.resolve({ id: testShipmentId, photoId: testPhotoId }),
    });
    assert.strictEqual(readRes.status, 200);
    assert.strictEqual(readRes.headers.get("content-type"), "image/png");
    assert.strictEqual(readRes.headers.get("cache-control"), "private, no-store, must-revalidate");

    // 4. Cross-tenant access denial: Intruder accessing private photo returns 403 Forbidden
    const intruderReq = makeAuthRequest(
      "GET",
      `http://localhost:3000/api/shipments/${testShipmentId}/photos/${testPhotoId}`,
      intruderUser
    );
    const intruderRes = await getSinglePhoto(intruderReq, {
      params: Promise.resolve({ id: testShipmentId, photoId: testPhotoId }),
    });
    assert.strictEqual(intruderRes.status, 403, "Cross-tenant intruder must be denied private image access");
  });

  // --------------------------------------------------------------------------
  // Check D: Counter-Offers, Expiry, Partner Approval & Terminal Guards
  // --------------------------------------------------------------------------
  await t.test("Counter-offer lifecycle: proposal, partner response, single-winner acceptance", async () => {
    // 1. Create rescue opportunity (inherits shipment cargoWeightKg = 4200)
    const opp = await createRescueOpportunity({
      organizationId: fleetOrg.id,
      shipmentId: testShipmentId,
      title: `Emergency Rescue ${testId}`,
      cargoDescription: "4.2T Vaccines at risk",
      tempRequirementMin: 2.0,
      tempRequirementMax: 8.0,
      actorId: fleetOwner.id,
    });
    assert.strictEqual(opp.cargoWeightKg, 4200, "Should inherit cargoWeightKg from shipment");

    // 2. Partner submits initial offer of ₹50,000
    const offer = await submitRescueOffer({
      opportunityId: opp.id,
      partnerOrgId: partnerOrg.id,
      submittedById: partnerDispatcher.id,
      offerAmount: 50000,
      capacityOfferedKg: 6000,
      storageType: "COLD_STORAGE",
      estimatedEtaMinutes: 25,
      validUntilHours: 4,
      notes: "Dedicated reefer bay ready",
    });
    assert.strictEqual(offer.offerAmount, 50000);
    assert.strictEqual(offer.status, "SUBMITTED");

    // 3. Intruder attempts to counter offer -> Denied 403
    const unauthorizedCounterReq = makeAuthRequest(
      "POST",
      `http://localhost:3000/api/rescue/opportunities/${opp.id}/offers/${offer.id}/counter`,
      intruderUser,
      { counterAmount: 38000 }
    );
    const unauthCounterRes = await submitCounterRoute(unauthorizedCounterReq, {
      params: Promise.resolve({ id: opp.id, offerId: offer.id }),
    });
    assert.strictEqual(unauthCounterRes.status, 403, "Unrelated user cannot submit counter-offer");

    // 4. Fleet Owner submits counter-offer of ₹42,000
    const counterReq = makeAuthRequest(
      "POST",
      `http://localhost:3000/api/rescue/opportunities/${opp.id}/offers/${offer.id}/counter`,
      fleetOwner,
      {
        counterAmount: 42000,
        counterNotes: "Proximity discount: truck is 12 km from facility dock",
      }
    );
    const counterRes = await submitCounterRoute(counterReq, {
      params: Promise.resolve({ id: opp.id, offerId: offer.id }),
    });
    assert.strictEqual(counterRes.status, 200);
    const counterBody = await counterRes.json();
    assert.strictEqual(counterBody.offer.counterAmount, 42000);
    assert.strictEqual(counterBody.offer.counterStatus, "SUBMITTED");
    assert.strictEqual(counterBody.offer.isPartnerApproved, false);

    // 5. Partner accepts counter-offer -> Updates offerAmount to agreed ₹42,000
    const partnerAcceptReq = makeAuthRequest(
      "POST",
      `http://localhost:3000/api/rescue/opportunities/${opp.id}/offers/${offer.id}/counter-response`,
      partnerDispatcher,
      { accept: true }
    );
    const partnerAcceptRes = await respondCounterRoute(partnerAcceptReq, {
      params: Promise.resolve({ id: opp.id, offerId: offer.id }),
    });
    assert.strictEqual(partnerAcceptRes.status, 200);
    const acceptedBody = await partnerAcceptRes.json();
    assert.strictEqual(acceptedBody.offer.offerAmount, 42000, "Agreed counter-amount updates quote");
    assert.strictEqual(acceptedBody.offer.isPartnerApproved, true);
    assert.strictEqual(acceptedBody.offer.counterStatus, "ACCEPTED");

    // 6. Fleet accepts the negotiated winning offer
    const acceptResult = await acceptRescueOffer({
      opportunityId: opp.id,
      offerId: offer.id,
      actorId: fleetOwner.id,
    });
    assert.strictEqual(acceptResult.opportunity.status, "ACCEPTED");
    assert.strictEqual(acceptResult.offer?.status, "ACCEPTED");

    // 7. Terminal-state guard: Cannot counter an already accepted/closed offer
    const terminalCounterReq = makeAuthRequest(
      "POST",
      `http://localhost:3000/api/rescue/opportunities/${opp.id}/offers/${offer.id}/counter`,
      fleetOwner,
      { counterAmount: 35000 }
    );
    const terminalCounterRes = await submitCounterRoute(terminalCounterReq, {
      params: Promise.resolve({ id: opp.id, offerId: offer.id }),
    });
    assert.strictEqual(terminalCounterRes.status, 409, "Cannot submit counter-offer after assignment");
  });

  // --------------------------------------------------------------------------
  // Check E: Advisory Incident Questions & Request Budget
  // --------------------------------------------------------------------------
  await t.test("AI Advisory incident questions, language localization, and request budget", async () => {
    const aiReq = makeAuthRequest(
      "POST",
      "http://localhost:3000/api/ai/analyze-incident",
      fleetOwner,
      {
        shipmentId: testShipmentId,
        advisoryQuestion: "Can cargo withstand 40 minutes at 11°C?",
        language: "hi",
      }
    );

    const aiRes = await analyzeIncidentRoute(aiReq);
    assert.strictEqual(aiRes.status, 200);
    const aiBody = await aiRes.json();
    assert.ok(aiBody.analysis?.summary);
    assert.ok(aiBody.assessmentId);
    assert.ok(typeof aiBody.budgetRemaining === "number");
    assert.ok(aiBody.budgetRemaining <= 19, "Budget remaining should decrement from 20");

    // Check DB persistence
    const saved = await prisma.incidentAssessment.findUnique({
      where: { id: aiBody.assessmentId },
    });
    assert.ok(saved);
    assert.strictEqual(saved.shipmentId, testShipmentId);
    assert.strictEqual(saved.language, "hi");
    assert.strictEqual(saved.advisoryQuestion, "Can cargo withstand 40 minutes at 11°C?");
  });
});
