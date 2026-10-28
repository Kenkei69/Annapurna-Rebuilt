import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import { ingestTelemetryReading } from "../../src/lib/telemetry";
import {
  detectMissingTelemetry,
  resolveAlert,
} from "../../src/lib/alerts";
import {
  isSimulatorEnabled,
  runSimulationScenario,
} from "../../src/lib/simulator";
import { createVehicle, provisionDevice } from "../../src/lib/fleet";
import { createShipment } from "../../src/lib/shipments";
import { AlertSeverity, AlertStatus, ShipmentStatus } from "@prisma/client";

test("Priority 2 & 3: Telemetry Ingestion, Out-of-Order Safety, Simulator Isolation & Alert Lifecycle", async () => {
  const fleetOrg = await prisma.organization.findUnique({
    where: { slug: "transcold-express" },
  });
  assert.ok(fleetOrg);

  const operator = await prisma.user.findUnique({
    where: { email: "operator@transcold.com" },
  });
  assert.ok(operator);

  // 1. Provision a vehicle, a simulated device, and an operational device
  const vehicle = await createVehicle({
    organizationId: fleetOrg.id,
    licensePlate: `SIM-REEFER-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    makeModel: "Simulation Reefer 3000",
    actorId: operator.id,
  });

  const simDevId = `DEV-SIM-${Date.now().toString().slice(-6)}`;
  const { device: simDevice } = await provisionDevice({
    organizationId: fleetOrg.id,
    deviceIdentifier: simDevId,
    hardwareModel: "ANNAPURNA-SIMULATOR-MK2",
    isSimulated: true,
  });

  const opDevId = `DEV-OP-${Date.now().toString().slice(-6)}`;
  await provisionDevice({
    organizationId: fleetOrg.id,
    deviceIdentifier: opDevId,
    hardwareModel: "ANNAPURNA-EDGE-S3",
    isSimulated: false,
  });

  // Test Simulator Isolation: cannot run simulation on operational hardware
  await assert.rejects(
    async () => {
      await runSimulationScenario(opDevId, "NORMAL");
    },
    /SIMULATION_TARGET_REJECTED/,
    "Operational hardware must reject simulation scenarios"
  );

  // Test Environment Simulator Toggle
  const originalEnableSim = process.env.ENABLE_SIMULATOR;
  try {
    process.env.ENABLE_SIMULATOR = "false";
    assert.equal(isSimulatorEnabled(), false);
    await assert.rejects(
      async () => {
        await runSimulationScenario(simDevId, "NORMAL");
      },
      /SIMULATOR_DISABLED/,
      "Simulation must fail when ENABLE_SIMULATOR=false"
    );
  } finally {
    if (originalEnableSim !== undefined) {
      process.env.ENABLE_SIMULATOR = originalEnableSim;
    } else {
      delete process.env.ENABLE_SIMULATOR;
    }
  }

  // 2. Create an active shipment linked to simDevice
  const shipment = await createShipment({
    organizationId: fleetOrg.id,
    title: "Vaccine Integrity Test",
    cargoType: "Biologics",
    tempMin: 2.0,
    tempMax: 6.0,
    originName: "Pune Serum Institute",
    destName: "Mumbai Cold Hub",
    assignedDeviceId: simDevice.id,
    assignedVehicleId: vehicle.id,
    actorId: operator.id,
  });

  // Verify initial status is DISPATCHED
  assert.equal(shipment.status, ShipmentStatus.DISPATCHED);

  // 3. Normal Telemetry -> transitions DISPATCHED to IN_TRANSIT
  const t0 = new Date(Date.now() - 100000);
  const res1 = await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 10,
    recordedAt: t0.toISOString(),
    temperature: 4.0,
    isSimulated: true,
  });
  assert.equal(res1.status, "accepted");

  const shipAfterT0 = await prisma.shipment.findUnique({
    where: { id: shipment.id },
  });
  assert.equal(shipAfterT0?.status, ShipmentStatus.IN_TRANSIT);
  assert.equal(shipAfterT0?.latestTemperature, 4.0);
  assert.equal(shipAfterT0?.latestRecordedAt?.getTime(), t0.getTime());

  // 4. Ingest newer reading (t2 = t0 + 50s)
  const t2 = new Date(t0.getTime() + 50000);
  await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 20,
    recordedAt: t2.toISOString(),
    temperature: 4.5,
    isSimulated: true,
  });

  const shipAfterT2 = await prisma.shipment.findUnique({
    where: { id: shipment.id },
  });
  assert.equal(shipAfterT2?.latestTemperature, 4.5);
  assert.equal(shipAfterT2?.latestRecordedAt?.getTime(), t2.getTime());

  // 5. Test Out-of-Order Reading: reading at (t1 = t0 + 20s) arrives AFTER t2
  const t1 = new Date(t0.getTime() + 20000);
  await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 15,
    recordedAt: t1.toISOString(),
    temperature: 5.8, // out of order
    isSimulated: true,
  });

  // Verify that the shipment's latest values were NOT overwritten by the older reading t1
  const shipAfterStale = await prisma.shipment.findUnique({
    where: { id: shipment.id },
  });
  assert.equal(
    shipAfterStale?.latestTemperature,
    4.5,
    "Stale out-of-order reading must NOT overwrite newer latestTemperature"
  );
  assert.equal(
    shipAfterStale?.latestRecordedAt?.getTime(),
    t2.getTime(),
    "Stale out-of-order reading must NOT roll back latestRecordedAt"
  );

  // 6. Test Ambiguous Device Assignment (device assigned to > 1 active shipment)
  const shipment2 = await createShipment({
    organizationId: fleetOrg.id,
    title: "Conflicting Shipment Assignment",
    cargoType: "Dairy",
    tempMin: 0.0,
    tempMax: 4.0,
    originName: "Nashik Farms",
    destName: "Mumbai Cold Hub",
    assignedDeviceId: simDevice.id, // Same device!
    assignedVehicleId: vehicle.id,
    actorId: operator.id,
  });

  // Ingestion must now fail closed with AMBIGUOUS_DEVICE_ASSIGNMENT
  await assert.rejects(
    async () => {
      await ingestTelemetryReading({
        deviceId: simDevId,
        sequence: 30,
        recordedAt: new Date().toISOString(),
        temperature: 3.0,
        isSimulated: true,
      });
    },
    /AMBIGUOUS_DEVICE_ASSIGNMENT/,
    "Device assigned to multiple active shipments must fail closed"
  );

  // Unlink conflicting shipment
  await prisma.shipment.update({
    where: { id: shipment2.id },
    data: { assignedDeviceId: null },
  });

  // 7. Alert Lifecycle: Temperature breach -> TEMP_HIGH_BREACH
  const t3 = new Date(t2.getTime() + 10000);
  const breachRes1 = await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 31,
    recordedAt: t3.toISOString(),
    temperature: 8.5, // > max 6.0
    isSimulated: true,
  });
  assert.equal(breachRes1.triggeredAlertsCount, 1);

  const shipAfterAlert = await prisma.shipment.findUnique({
    where: { id: shipment.id },
    include: { alerts: true },
  });
  assert.equal(shipAfterAlert?.status, ShipmentStatus.ALERTED);
  const highBreachAlert = shipAfterAlert?.alerts.find(
    (a) => a.ruleCode === "TEMP_HIGH_BREACH"
  );
  assert.ok(highBreachAlert);
  assert.equal(highBreachAlert?.severity, AlertSeverity.HIGH);
  assert.equal(highBreachAlert?.status, AlertStatus.ACTIVE);

  // 8. Consecutive Breaches -> Escalation to SUSTAINED_BREACH (CRITICAL)
  const t4 = new Date(t3.getTime() + 10000);
  await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 32,
    recordedAt: t4.toISOString(),
    temperature: 8.8,
    isSimulated: true,
  });

  const t5 = new Date(t4.getTime() + 10000);
  const breachRes3 = await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 33,
    recordedAt: t5.toISOString(),
    temperature: 9.1,
    isSimulated: true,
  });
  assert.equal(breachRes3.triggeredAlertsCount, 1);

  const shipAfterEscalation = await prisma.shipment.findUnique({
    where: { id: shipment.id },
    include: { alerts: true },
  });
  const sustainedAlert = shipAfterEscalation?.alerts.find(
    (a) => a.ruleCode === "SUSTAINED_BREACH"
  );
  assert.ok(sustainedAlert, "Sustained breach alert must be generated");
  assert.equal(sustainedAlert?.severity, AlertSeverity.CRITICAL);
  assert.equal(sustainedAlert?.status, AlertStatus.ACTIVE);
  assert.equal(
    sustainedAlert?.escalatedFromId,
    highBreachAlert?.id,
    "Sustained breach must link to prior high breach alert"
  );

  // Prior alert must be superseded/acknowledged
  const priorAlert = shipAfterEscalation?.alerts.find(
    (a) => a.id === highBreachAlert?.id
  );
  assert.equal(priorAlert?.status, AlertStatus.ACKNOWLEDGED);

  // 9. Unsafe Alert Resolution Guard
  // Attempting to resolve while latest temperature is still 9.1°C (> 6.0°C) without override
  await assert.rejects(
    async () => {
      await resolveAlert({
        alertId: sustainedAlert.id,
        actorId: operator.id,
        resolutionNotes: "Premature resolution attempt",
      });
    },
    /UNSAFE_RESOLUTION_REJECTED/,
    "Resolution while temperature is out-of-band must be rejected without override reason"
  );

  // Resolving with an explicit overrideReason succeeds
  const resolvedWithOverride = await resolveAlert({
    alertId: sustainedAlert.id,
    actorId: operator.id,
    resolutionNotes: "Manual reefer recalibration performed",
    overrideReason: "Sensor probe validated by field technician",
  });
  assert.equal(resolvedWithOverride.status, AlertStatus.RESOLVED);

  // 10. Missing Telemetry Detection
  // Detect missing telemetry for shipments exceeding heartbeat threshold
  const missingAlerts = await detectMissingTelemetry(0); // 0 minutes cutoff for testing
  assert.ok(missingAlerts.length >= 1, "Missing telemetry alert should be triggered");
  const ourMissingAlert = missingAlerts.find((a) => a.shipmentId === shipment.id);
  assert.ok(ourMissingAlert, "Shipment should receive MISSING_TELEMETRY alert");
  assert.equal(ourMissingAlert?.ruleCode, "MISSING_TELEMETRY");
});
