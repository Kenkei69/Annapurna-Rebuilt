import { z } from "zod";
import { prisma } from "../db";
import { hashDeviceApiKey } from "../fleet";
import { evaluateTelemetryAlerts } from "../alerts";
import { ShipmentStatus } from "@prisma/client";

export const TelemetryPayloadSchema = z.object({
  deviceId: z.string().min(3).max(64),
  sequence: z.number().int().positive(),
  recordedAt: z.string().datetime().or(z.date()),
  temperature: z.number().min(-60).max(80),
  humidity: z.number().min(0).max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  batteryPct: z.number().min(0).max(100).optional(),
  isSimulated: z.boolean().optional().default(false),
});

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;

export async function authenticateDevice(deviceId: string, rawApiKey: string) {
  const hash = hashDeviceApiKey(rawApiKey);
  const device = await prisma.device.findUnique({
    where: { deviceIdentifier: deviceId },
  });

  if (!device || device.status !== "ACTIVE" || device.apiKeyHash !== hash) {
    return null;
  }
  return device;
}

export async function ingestTelemetryReading(payload: TelemetryPayload) {
  const recordedDate = new Date(payload.recordedAt);
  const now = new Date();

  // Guard against extreme future clock skew (> 10 minutes ahead)
  if (recordedDate.getTime() > now.getTime() + 10 * 60 * 1000) {
    throw new Error("FUTURE_TIMESTAMP_REJECTED: Reading timestamp is in the future");
  }

  // Find device
  const device = await prisma.device.findUnique({
    where: { deviceIdentifier: payload.deviceId },
    include: {
      shipments: {
        where: {
          status: {
            in: [
              ShipmentStatus.DISPATCHED,
              ShipmentStatus.IN_TRANSIT,
              ShipmentStatus.ALERTED,
              ShipmentStatus.RESCUE_PENDING,
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!device) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  const activeShipment = device.shipments[0] || null;

  // Deduplication check
  const existing = await prisma.telemetryReading.findUnique({
    where: {
      deviceId_sequence: {
        deviceId: device.id,
        sequence: payload.sequence,
      },
    },
  });

  if (existing) {
    return {
      status: "duplicate_ignored" as const,
      readingId: existing.id,
      deduplicated: true,
      shipmentId: activeShipment?.id ?? null,
      triggeredAlertsCount: 0,
    };
  }

  // Record reading in transaction
  const result = await prisma.$transaction(async (tx) => {
    const reading = await tx.telemetryReading.create({
      data: {
        deviceId: device.id,
        shipmentId: activeShipment?.id ?? null,
        sequence: payload.sequence,
        recordedAt: recordedDate,
        temperature: payload.temperature,
        humidity: payload.humidity ?? null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        batteryPct: payload.batteryPct ?? null,
        isSimulated: payload.isSimulated,
      },
    });

    // Update device lastSeenAt
    await tx.device.update({
      where: { id: device.id },
      data: { lastSeenAt: now },
    });

    // Update shipment telemetry & transition to IN_TRANSIT if currently DISPATCHED
    if (activeShipment) {
      const nextStatus =
        activeShipment.status === ShipmentStatus.DISPATCHED
          ? ShipmentStatus.IN_TRANSIT
          : undefined;

      await tx.shipment.update({
        where: { id: activeShipment.id },
        data: {
          latestTemperature: payload.temperature,
          latestHumidity: payload.humidity ?? activeShipment.latestHumidity,
          latestLat: payload.latitude ?? activeShipment.latestLat,
          latestLng: payload.longitude ?? activeShipment.latestLng,
          latestRecordedAt: recordedDate,
          ...(nextStatus ? { status: nextStatus } : {}),
        },
      });
    }

    return reading;
  });

  // Evaluate alerts if reading belongs to an active shipment
  let triggeredAlerts: unknown[] = [];
  if (activeShipment) {
    triggeredAlerts = await evaluateTelemetryAlerts(activeShipment.id, result);
  }

  return {
    status: "accepted",
    readingId: result.id,
    shipmentId: activeShipment?.id ?? null,
    triggeredAlertsCount: triggeredAlerts.length,
    deduplicated: false,
  };
}
