import test from "node:test";
import assert from "node:assert/strict";
import { TelemetryPayloadSchema } from "../../src/lib/telemetry";
import { hashDeviceApiKey } from "../../src/lib/fleet";

test("Telemetry Module - Valid telemetry payload passes schema", () => {
  const payload = {
    deviceId: "DEVICE-TEST-001",
    sequence: 1,
    recordedAt: new Date().toISOString(),
    temperature: 3.5,
    humidity: 65.0,
    latitude: 19.076,
    longitude: 72.877,
    batteryPct: 95.0,
    isSimulated: true,
  };

  const parsed = TelemetryPayloadSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("Telemetry Module - Out-of-bounds temperature is rejected", () => {
  const invalidPayload = {
    deviceId: "DEVICE-TEST-001",
    sequence: 1,
    recordedAt: new Date().toISOString(),
    temperature: 150.0, // Exceeds +80°C max bound
  };

  const parsed = TelemetryPayloadSchema.safeParse(invalidPayload);
  assert.equal(parsed.success, false);
});

test("Telemetry Module - Device API key hashing is deterministic SHA-256", () => {
  const key = "dev_key_sample_key_123456789";
  const hash1 = hashDeviceApiKey(key);
  const hash2 = hashDeviceApiKey(key);

  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64); // SHA-256 hex length
});
