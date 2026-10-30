import test from "node:test";
import assert from "node:assert/strict";
import { ingestTelemetryReading } from "../../src/lib/telemetry";

test("Telemetry Edge Cases - Future timestamps (> 10m drift) are rejected", async () => {
  const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour in future

  await assert.rejects(
    async () => {
      await ingestTelemetryReading({
        deviceId: "DEVICE-APN-001",
        sequence: 999999,
        recordedAt: futureTime,
        temperature: 3.5,
        isSimulated: true,
      });
    },
    /FUTURE_TIMESTAMP_REJECTED/,
    "Readings with excessive forward clock drift must be rejected"
  );
});

test("Telemetry Edge Cases - Sequence deduplication prevents duplicate row creation", async () => {
  const seq = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100000);
  const time = new Date().toISOString();

  // First ingestion on operational device
  const res1 = await ingestTelemetryReading({
    deviceId: "DEVICE-APN-001",
    sequence: seq,
    recordedAt: time,
    temperature: 3.8,
    isSimulated: false,
  });
  assert.equal(res1.status, "accepted");

  // Duplicate replay ingestion
  const res2 = await ingestTelemetryReading({
    deviceId: "DEVICE-APN-001",
    sequence: seq,
    recordedAt: time,
    temperature: 3.8,
    isSimulated: false,
  });
  assert.equal(res2.status, "duplicate_ignored");
  assert.equal(res2.deduplicated, true);
});

test("Telemetry Isolation - Ingesting simulated telemetry into operational device is rejected", async () => {
  const seq = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100000);
  const time = new Date().toISOString();

  await assert.rejects(
    async () => {
      await ingestTelemetryReading({
        deviceId: "DEVICE-APN-001", // Operational hardware
        sequence: seq,
        recordedAt: time,
        temperature: 4.0,
        isSimulated: true, // Marked simulated
      });
    },
    /SIMULATION_NOT_PERMITTED/,
    "Operational hardware must reject simulated telemetry packets"
  );
});
