import { prisma } from "../db";
import { ingestTelemetryReading } from "../telemetry";

export type SimulatorScenario =
  | "NORMAL"
  | "GRADUAL_WARMING"
  | "DOOR_AJAR"
  | "SENSOR_OFFLINE"
  | "REPLAY_DUPLICATE";

export interface SimulatorRunResult {
  scenario: SimulatorScenario;
  deviceId: string;
  readingsInjected: number;
  triggeredAlerts: number;
  details: string[];
}

export async function runSimulationScenario(
  deviceId: string,
  scenario: SimulatorScenario
): Promise<SimulatorRunResult> {
  const device = await prisma.device.findUnique({
    where: { deviceIdentifier: deviceId },
    include: {
      shipments: {
        where: {
          status: { in: ["DISPATCHED", "IN_TRANSIT", "ALERTED", "RESCUE_PENDING"] },
        },
        take: 1,
      },
      telemetryReadings: {
        orderBy: { sequence: "desc" },
        take: 1,
      },
    },
  });

  if (!device) throw new Error("SIMULATOR_DEVICE_NOT_FOUND");

  let baseSequence = (device.telemetryReadings[0]?.sequence || 0) + 1;
  const shipment = device.shipments[0];
  const targetMin = shipment?.tempMin ?? 2.0;
  const targetMax = shipment?.tempMax ?? 6.0;

  const details: string[] = [];
  let triggeredAlerts = 0;
  let readingsInjected = 0;

  const now = Date.now();

  if (scenario === "NORMAL") {
    // 3 clean readings within allowed range
    const temps = [
      targetMin + 0.5,
      targetMin + 1.0,
      targetMin + 0.8,
    ];
    for (let i = 0; i < temps.length; i++) {
      const recTime = new Date(now - (temps.length - 1 - i) * 60000);
      const res = await ingestTelemetryReading({
        deviceId: device.deviceIdentifier,
        sequence: baseSequence++,
        recordedAt: recTime.toISOString(),
        temperature: temps[i],
        humidity: 62.0 + i,
        latitude: 19.076 + i * 0.005,
        longitude: 72.877 + i * 0.005,
        batteryPct: 98 - i,
        isSimulated: true,
      });
      readingsInjected++;
      triggeredAlerts += res.triggeredAlertsCount ?? 0;
      details.push(`Normal reading ${temps[i]}°C injected at sequence ${baseSequence - 1}.`);
    }
  } else if (scenario === "GRADUAL_WARMING") {
    // 4 readings with rising temperature breaching tempMax to trigger SUSTAINED_BREACH
    const temps = [
      targetMax + 0.2,
      targetMax + 1.2,
      targetMax + 2.5,
      targetMax + 4.1,
    ];
    for (let i = 0; i < temps.length; i++) {
      const recTime = new Date(now - (temps.length - 1 - i) * 60000);
      const res = await ingestTelemetryReading({
        deviceId: device.deviceIdentifier,
        sequence: baseSequence++,
        recordedAt: recTime.toISOString(),
        temperature: temps[i],
        humidity: 70.0 + i * 2,
        latitude: 19.08 + i * 0.01,
        longitude: 72.88 + i * 0.01,
        batteryPct: 92 - i,
        isSimulated: true,
      });
      readingsInjected++;
      triggeredAlerts += res.triggeredAlertsCount ?? 0;
      details.push(
        `Warming breach reading ${temps[i]}°C (max: ${targetMax}°C) at sequence ${baseSequence - 1}.`
      );
    }
  } else if (scenario === "DOOR_AJAR") {
    // Sudden spike + high humidity
    const temps = [targetMax + 1.0, targetMax + 6.0];
    for (let i = 0; i < temps.length; i++) {
      const recTime = new Date(now - (temps.length - 1 - i) * 30000);
      const res = await ingestTelemetryReading({
        deviceId: device.deviceIdentifier,
        sequence: baseSequence++,
        recordedAt: recTime.toISOString(),
        temperature: temps[i],
        humidity: 95.0,
        latitude: 19.12,
        longitude: 72.92,
        batteryPct: 88,
        isSimulated: true,
      });
      readingsInjected++;
      triggeredAlerts += res.triggeredAlertsCount ?? 0;
      details.push(
        `Door ajar / thermal shock reading ${temps[i]}°C, 95% humidity at sequence ${baseSequence - 1}.`
      );
    }
  } else if (scenario === "SENSOR_OFFLINE") {
    // Insert reading timestamped 45 minutes in the past
    const staleTime = new Date(now - 45 * 60 * 1000);
    const res = await ingestTelemetryReading({
      deviceId: device.deviceIdentifier,
      sequence: baseSequence++,
      recordedAt: staleTime.toISOString(),
      temperature: (targetMin + targetMax) / 2,
      humidity: 60.0,
      latitude: 19.20,
      longitude: 72.95,
      batteryPct: 15,
      isSimulated: true,
    });
    readingsInjected++;
    triggeredAlerts += res.triggeredAlertsCount ?? 0;
    details.push(`Stale reading timestamped 45 minutes ago injected to simulate device drop-off.`);
  } else if (scenario === "REPLAY_DUPLICATE") {
    // First legitimate reading
    const legitimateSeq = baseSequence++;
    const res1 = await ingestTelemetryReading({
      deviceId: device.deviceIdentifier,
      sequence: legitimateSeq,
      recordedAt: new Date(now - 10000).toISOString(),
      temperature: targetMin + 1.0,
      isSimulated: true,
    });
    readingsInjected++;
    details.push(`Legitimate packet sequence ${legitimateSeq} accepted.`);

    // Duplicate reading with the same sequence
    const res2 = await ingestTelemetryReading({
      deviceId: device.deviceIdentifier,
      sequence: legitimateSeq,
      recordedAt: new Date(now - 5000).toISOString(),
      temperature: targetMin + 1.0,
      isSimulated: true,
    });
    details.push(`Duplicate packet sequence ${legitimateSeq} status: ${res2.status}.`);
  }

  return {
    scenario,
    deviceId,
    readingsInjected,
    triggeredAlerts,
    details,
  };
}
