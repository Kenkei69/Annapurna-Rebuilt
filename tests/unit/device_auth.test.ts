import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import { authenticateDevice } from "../../src/lib/telemetry";
import { hashDeviceApiKey } from "../../src/lib/fleet";

test("Device Authentication - Accepts valid provisioned API key", async () => {
  // Use seeded DEVICE-APN-001
  const validKey = "dev_key_apn_secret_seed_key_001";
  const device = await authenticateDevice("DEVICE-APN-001", validKey);

  assert.ok(device, "Device must authenticate successfully with provisioned key");
  assert.equal(device.deviceIdentifier, "DEVICE-APN-001");
  assert.equal(device.status, "ACTIVE");
});

test("Device Authentication - Rejects invalid or mismatched API key", async () => {
  const invalidKey = "dev_key_wrong_unauthorized_token";
  const device = await authenticateDevice("DEVICE-APN-001", invalidKey);

  assert.equal(device, null, "Device authentication must fail with incorrect key");
});

test("Device Authentication - Rejects non-existent device identifier", async () => {
  const device = await authenticateDevice("NON-EXISTENT-DEVICE-999", "any_key");

  assert.equal(device, null, "Device authentication must fail for unknown device");
});
