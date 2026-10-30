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
  // (Simulated devices are excluded from operational gap monitoring by design)
  const opDevice = await prisma.device.findUniqueOrThrow({
    where: { deviceIdentifier: opDevId },
  });
  const opShipment = await createShipment({
    organizationId: fleetOrg.id,
    title: "Operational Vaccine Shipment",
    cargoType: "Biologics",
    tempMin: 2.0,
    tempMax: 6.0,
    originName: "Pune Serum Institute",
    destName: "Mumbai Cold Hub",
    assignedDeviceId: opDevice.id,
    assignedVehicleId: vehicle.id,
    actorId: operator.id,
  });
  await prisma.shipment.update({
    where: { id: opShipment.id },
    data: {
      status: ShipmentStatus.IN_TRANSIT,
      latestRecordedAt: new Date(Date.now() - 60000),
    },
  });

  const missingAlerts = await detectMissingTelemetry(0); // 0 minutes cutoff for testing
  assert.ok(missingAlerts.length >= 1, "Missing telemetry alert should be triggered");
  const ourMissingAlert = missingAlerts.find((a) => a.shipmentId === opShipment.id);
  assert.ok(ourMissingAlert, "Shipment should receive MISSING_TELEMETRY alert");
  assert.equal(ourMissingAlert?.ruleCode, "MISSING_TELEMETRY");

  // 11. Simultaneous Duplicate Packets Ingested Concurrently
  const dupSeq = 55;
  const [dupResA, dupResB] = await Promise.all([
    ingestTelemetryReading({
      deviceId: simDevId,
      sequence: dupSeq,
      recordedAt: new Date().toISOString(),
      temperature: 4.2,
      isSimulated: true,
    }),
    ingestTelemetryReading({
      deviceId: simDevId,
      sequence: dupSeq,
      recordedAt: new Date().toISOString(),
      temperature: 4.2,
      isSimulated: true,
    }),
  ]);

  // One accepted, one duplicate_ignored (or both safely handled)
  const results = [dupResA.status, dupResB.status];
  assert.ok(results.includes("accepted"), "One concurrent packet must be accepted");
  assert.ok(results.includes("duplicate_ignored"), "One concurrent packet must be marked duplicate_ignored");

  const createdCount = await prisma.telemetryReading.count({
    where: { deviceId: simDevice.id, sequence: dupSeq },
  });
  assert.equal(createdCount, 1, "Database unique constraint must ensure exactly 1 reading row exists");

  // 12. Late Historical Reading Safety
  const shipBeforeLate = await prisma.shipment.findUnique({ where: { id: shipment.id } });
  const liveLatestTemp = shipBeforeLate?.latestTemperature;
  const liveLatestTime = shipBeforeLate?.latestRecordedAt?.getTime();

  // Ingest reading from 2 hours ago with extreme breach temperature
  const lateTime = new Date(Date.now() - 7200000);
  const lateRes = await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 5, // older sequence
    recordedAt: lateTime.toISOString(),
    temperature: 19.5, // extreme high temp in the past
    isSimulated: true,
  });
  assert.equal(lateRes.triggeredAlertsCount, 0, "Late reading must NOT trigger active live alerts");

  const shipAfterLate = await prisma.shipment.findUnique({
    where: { id: shipment.id },
    include: { alerts: { where: { status: AlertStatus.ACTIVE } } },
  });
  assert.equal(
    shipAfterLate?.latestTemperature,
    liveLatestTemp,
    "Late reading must NOT overwrite live latestTemperature"
  );
  assert.equal(
    shipAfterLate?.latestRecordedAt?.getTime(),
    liveLatestTime,
    "Late reading must NOT overwrite live latestRecordedAt"
  );

  // 13. Ingestion Racing Shipment Terminal State (DELIVERED/CANCELLED)
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: { status: ShipmentStatus.DELIVERED },
  });

  await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 60,
    recordedAt: new Date().toISOString(),
    temperature: 4.0,
    isSimulated: true,
  });

  const shipDeliveredCheck = await prisma.shipment.findUnique({ where: { id: shipment.id } });
  assert.equal(
    shipDeliveredCheck?.status,
    ShipmentStatus.DELIVERED,
    "Ingestion must never revert a DELIVERED terminal status back to IN_TRANSIT"
  );

  // 14. Recovery with Hysteresis and Renewed Breach
  const recoveryShipment = await createShipment({
    organizationId: fleetOrg.id,
    title: "Hysteresis Recovery Test Shipment",
    cargoType: "Dairy",
    tempMin: 2.0,
    tempMax: 6.0,
    originName: "Depot X",
    destName: "Depot Y",
    assignedDeviceId: simDevice.id,
    assignedVehicleId: vehicle.id,
    actorId: operator.id,
  });

  // Breach 1 -> ALERTED
  await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 70,
    recordedAt: new Date(Date.now() - 60000).toISOString(),
    temperature: 8.5,
    isSimulated: true,
  });

  const recShipBreached = await prisma.shipment.findUnique({
    where: { id: recoveryShipment.id },
    include: { alerts: { where: { status: AlertStatus.ACTIVE } } },
  });
  assert.equal(recShipBreached?.status, ShipmentStatus.ALERTED);
  assert.equal(recShipBreached?.alerts.length, 1);

  // Temperature recovers within hysteresis band (4.0°C <= 6.0 - 0.5)
  await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 71,
    recordedAt: new Date().toISOString(),
    temperature: 4.0,
    isSimulated: true,
  });

  const recShipRecovered = await prisma.shipment.findUnique({
    where: { id: recoveryShipment.id },
    include: { alerts: true },
  });
  assert.equal(recShipRecovered?.status, ShipmentStatus.IN_TRANSIT, "Status must return to IN_TRANSIT on recovery");
  const autoResolvedAlert = recShipRecovered?.alerts.find((a) => a.ruleCode === "TEMP_HIGH_BREACH");
  assert.equal(autoResolvedAlert?.status, AlertStatus.RESOLVED);
  assert.ok(autoResolvedAlert?.resolutionNotes?.includes("0.5°C hysteresis margin satisfied"));

  // Renewed breach after recovery generates a fresh incident
  await ingestTelemetryReading({
    deviceId: simDevId,
    sequence: 72,
    recordedAt: new Date(Date.now() + 1000).toISOString(),
    temperature: 9.0,
    isSimulated: true,
  });

  const recShipRenewed = await prisma.shipment.findUnique({
    where: { id: recoveryShipment.id },
    include: { alerts: { where: { status: AlertStatus.ACTIVE } } },
  });
  assert.equal(recShipRenewed?.status, ShipmentStatus.ALERTED);
  assert.equal(recShipRenewed?.alerts.length, 1, "New active breach alert must be created on renewed breach");

  // 15. Revoked / Suspended Device Rejected
  await prisma.device.update({
    where: { id: simDevice.id },
    data: { status: "SUSPENDED" },
  });

  await assert.rejects(
    async () => {
      await ingestTelemetryReading({
        deviceId: simDevId,
        sequence: 80,
        recordedAt: new Date().toISOString(),
        temperature: 4.0,
        isSimulated: true,
      });
    },
    /DEVICE_NOT_ACTIVE/,
    "Revoked device must be rejected by telemetry ingestion"
  );
});
