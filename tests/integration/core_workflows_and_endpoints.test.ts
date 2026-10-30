import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import { GET as getHealth } from "../../src/app/api/health/route";
import { GET as getReady } from "../../src/app/api/ready/route";
import { POST as evaluateGaps } from "../../src/app/api/telemetry/evaluate-gaps/route";
import { PATCH as updateDevice } from "../../src/app/api/devices/[id]/route";
import { GET as getOrgMembers } from "../../src/app/api/org/members/route";
import { PATCH as updateOrgSettings } from "../../src/app/api/org/settings/route";
import { GET as getPublicTrack } from "../../src/app/api/shipments/public-track/route";
import { hashPassword, createSessionToken, authCookieConfig } from "../../src/lib/auth";
import { UserRole, OrgType, OrgMemberRole, DeviceStatus, ShipmentStatus } from "@prisma/client";

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

test("Phase 2 Core Workflows: Health, Readiness, Device Lifecycle, Gaps & Org Management", async (t) => {
  const testId = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await hashPassword("ValidPassword123!");

  // 1. Setup isolated test tenant with Owner, Dispatcher, and Driver
  const tenantOrg = await prisma.organization.create({
    data: {
      name: `Core Test Org ${testId}`,
      slug: `core-org-${testId}`,
      type: OrgType.FLEET,
    },
  });

  const ownerUser = await prisma.user.create({
    data: {
      email: `owner-${testId}@test.local`,
      passwordHash,
      name: "Org Owner",
      role: UserRole.OPERATOR,
      memberships: {
        create: { organizationId: tenantOrg.id, orgRole: OrgMemberRole.OWNER },
      },
    },
  });

  const driverUser = await prisma.user.create({
    data: {
      email: `driver-${testId}@test.local`,
      passwordHash,
      name: "Assigned Driver",
      role: UserRole.DRIVER,
      memberships: {
        create: { organizationId: tenantOrg.id, orgRole: OrgMemberRole.DRIVER },
      },
    },
  });

  // Setup device for testing lifecycle
  const testDevice = await prisma.device.create({
    data: {
      organizationId: tenantOrg.id,
      deviceIdentifier: `DEV-${testId}`,
      hardwareModel: "ANNAPURNA-EDGE-S3",
      apiKeyHash: "dummy-hash",
      status: DeviceStatus.ACTIVE,
    },
  });

  await t.test("Liveness endpoint (/api/health) returns 200 and 'ok'", async () => {
    const res = await getHealth();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "ok");
    assert.equal(data.service, "annapurna-rebuilt");
    assert.ok(data.timestamp);
  });

  await t.test("Readiness endpoint (/api/ready) verifies DB connectivity and returns 200", async () => {
    const res = await getReady();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "ready");
    assert.equal(data.checks?.database?.status, "ok");
    assert.ok(typeof data.checks?.database?.latencyMs === "number");
  });

  await t.test("Device status transitions via PATCH /api/devices/[id]", async () => {
    // 1. Transition ACTIVE -> SUSPENDED
    const suspendReq = makeAuthRequest(
      "PATCH",
      `http://localhost/api/devices/${testDevice.id}`,
      ownerUser,
      { status: DeviceStatus.SUSPENDED, reason: "Scheduled maintenance inspection" }
    );
    const suspendRes = await updateDevice(suspendReq, { params: Promise.resolve({ id: testDevice.id }) });
    assert.equal(suspendRes.status, 200);
    const suspendData = await suspendRes.json();
    assert.equal(suspendData.device.status, DeviceStatus.SUSPENDED);

    // Verify DB updated
    const dbDevice1 = await prisma.device.findUnique({ where: { id: testDevice.id } });
    assert.equal(dbDevice1?.status, DeviceStatus.SUSPENDED);

    // 2. Unauthorized driver attempting device mutation fails with 403
    const driverReq = makeAuthRequest(
      "PATCH",
      `http://localhost/api/devices/${testDevice.id}`,
      driverUser,
      { status: DeviceStatus.ACTIVE, reason: "Driver unauthorized attempt" }
    );
    const driverRes = await updateDevice(driverReq, { params: Promise.resolve({ id: testDevice.id }) });
    assert.equal(driverRes.status, 403);

    // 3. Re-activate device (SUSPENDED -> ACTIVE)
    const activateReq = makeAuthRequest(
      "PATCH",
      `http://localhost/api/devices/${testDevice.id}`,
      ownerUser,
      { status: DeviceStatus.ACTIVE, reason: "Maintenance complete" }
    );
    const activateRes = await updateDevice(activateReq, { params: Promise.resolve({ id: testDevice.id }) });
    assert.equal(activateRes.status, 200);
  });

  await t.test("Telemetry gap evaluation detects stalled in-transit shipments", async () => {
    // Create an in-transit shipment with stale reading (> 20 minutes ago)
    const twentyFiveMinsAgo = new Date(Date.now() - 25 * 60 * 1000);
    const stalledShipment = await prisma.shipment.create({
      data: {
        organizationId: tenantOrg.id,
        trackingNumber: `APN-STALL-${testId}`,
        title: "Stalled Cold Cargo",
        cargoType: "Dairy",
        tempMin: 2.0,
        tempMax: 6.0,
        originName: "Dairy Processing Plant",
        destName: "Cold Storage Warehouse",
        assignedDeviceId: testDevice.id,
        status: ShipmentStatus.IN_TRANSIT,
        latestRecordedAt: twentyFiveMinsAgo,
      },
    });

    // Evaluate gaps with window of 15 minutes
    const evalReq = makeAuthRequest(
      "POST",
      "http://localhost/api/telemetry/evaluate-gaps?windowMinutes=15",
      ownerUser
    );
    const evalRes = await evaluateGaps(evalReq);
    assert.equal(evalRes.status, 200);
    const evalData = await evalRes.json();
    assert.ok(evalData.success);

    // Check that missing telemetry alert was generated for stalled shipment
    const alert = await prisma.alert.findFirst({
      where: {
        shipmentId: stalledShipment.id,
        ruleCode: "MISSING_TELEMETRY",
      },
    });
    assert.ok(alert, "Expected MISSING_TELEMETRY alert to be generated");
    assert.equal(alert.severity, "HIGH");

    // Shipment status should transition to ALERTED
    const updatedShipment = await prisma.shipment.findUnique({
      where: { id: stalledShipment.id },
    });
    assert.equal(updatedShipment?.status, ShipmentStatus.ALERTED);
  });

  await t.test("Organization settings and member management enforces owner authority", async () => {
    // 1. Owner lists members
    const listReq = makeAuthRequest("GET", "http://localhost/api/org/members", ownerUser);
    const listRes = await getOrgMembers(listReq);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(Array.isArray(listData.members));
    assert.ok(listData.members.length >= 2);

    // 2. Owner updates org name
    const updateOrgReq = makeAuthRequest(
      "PATCH",
      "http://localhost/api/org/settings",
      ownerUser,
      { name: `Updated ${tenantOrg.name}` }
    );
    const updateOrgRes = await updateOrgSettings(updateOrgReq);
    assert.equal(updateOrgRes.status, 200);
    const updatedOrgData = await updateOrgRes.json();
    assert.equal(updatedOrgData.organization.name, `Updated ${tenantOrg.name}`);
  });

  await t.test("Public tracking endpoint returns sanitized data and denies unmapped requests", async () => {
    const trackShipment = await prisma.shipment.create({
      data: {
        organizationId: tenantOrg.id,
        trackingNumber: `APN-TRACK-${testId}`,
        title: "Trackable Cargo Consignment",
        cargoType: "Produce",
        tempMin: 2.0,
        tempMax: 6.0,
        originName: "Nashik Hub",
        destName: "Mumbai Port",
        status: ShipmentStatus.IN_TRANSIT,
      },
    });

    // 1. Missing tracking number parameter -> 400
    const emptyReq = new Request("http://localhost/api/shipments/public-track");
    const emptyRes = await getPublicTrack(emptyReq);
    assert.equal(emptyRes.status, 400);

    // 2. Non-existent tracking number -> 404
    const notFoundReq = new Request("http://localhost/api/shipments/public-track?trackingNumber=APN-NONEXISTENT");
    const notFoundRes = await getPublicTrack(notFoundReq);
    assert.equal(notFoundRes.status, 404);

    // 3. Valid tracking number -> 200 with strictly sanitized projection
    const validReq = new Request(`http://localhost/api/shipments/public-track?trackingNumber=${trackShipment.trackingNumber}`);
    const validRes = await getPublicTrack(validReq);
    assert.equal(validRes.status, 200);
    const validData = await validRes.json();
    assert.ok(validData.success);
    assert.equal(validData.shipment.trackingNumber, trackShipment.trackingNumber);
    assert.equal(validData.shipment.title, trackShipment.title);
    // Invariant: Zero secret tokens or internal database IDs leaked
    assert.equal((validData.shipment as any).passwordHash, undefined);
    assert.equal((validData.shipment as any).apiKeyHash, undefined);
    assert.equal((validData.shipment as any).organizationId, undefined);
  });
});
