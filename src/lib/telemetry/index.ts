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
  });

  if (!device) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  if (device.status !== "ACTIVE") {
    throw new Error("DEVICE_NOT_ACTIVE: Device is revoked, decommissioned, or suspended");
  }

  // Check simulation boundary: operational devices cannot accept simulated telemetry
  const isDeviceSimulated =
    device.isSimulated || device.hardwareModel.toUpperCase().includes("SIMULATOR");
  if (payload.isSimulated && !isDeviceSimulated) {
    throw new Error(
      "SIMULATION_NOT_PERMITTED: Cannot ingest simulated telemetry into an operational hardware device."
    );
  }

  // Ambiguity check: verify device is not assigned to multiple active shipments concurrently
  const activeShipments = await prisma.shipment.findMany({
    where: {
      assignedDeviceId: device.id,
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
    take: 2,
  });

  if (activeShipments.length > 1) {
    throw new Error(
      `AMBIGUOUS_DEVICE_ASSIGNMENT: Device ${device.deviceIdentifier} is concurrently assigned to multiple active shipments (${activeShipments.map((s) => s.trackingNumber).join(", ")}). Ingestion halted.`
    );
  }

  const activeShipment = activeShipments[0] || null;

  // Deduplication check (fast-path pre-check)
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

  // Record reading and evaluate alerts atomically in a single transaction
  try {
    const { reading, triggeredAlerts } = await prisma.$transaction(async (tx) => {
      const createdReading = await tx.telemetryReading.create({
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

      // Handle shipment update with out-of-order and status protection
      let isStale = false;
      let isTerminal = false;

      if (activeShipment) {
        // Lock shipment row to coordinate atomically with concurrent transitions or readings
        const [lockedShipment] = await tx.$queryRaw<
          Array<{
            id: string;
            status: string;
            latestRecordedAt: Date | null;
            latestHumidity: number | null;
            latestLat: number | null;
            latestLng: number | null;
          }>
        >`
          SELECT "id", "status", "latestRecordedAt", "latestHumidity", "latestLat", "latestLng"
          FROM "Shipment"
          WHERE "id" = ${activeShipment.id}
          FOR UPDATE
        `;

        if (lockedShipment) {
          isTerminal =
            lockedShipment.status === ShipmentStatus.DELIVERED ||
            lockedShipment.status === ShipmentStatus.CANCELLED ||
            lockedShipment.status === ShipmentStatus.RESCUED;

          // Find latest persisted sequence for this device
          const lastReading = await tx.telemetryReading.findFirst({
            where: { deviceId: device.id },
            orderBy: { sequence: "desc" },
            select: { sequence: true },
          });

          // Documented tie-break rule: If timestamp is earlier, or timestamp matches but sequence is not newer, reading is stale
          isStale =
            lockedShipment.latestRecordedAt !== null &&
            (recordedDate < lockedShipment.latestRecordedAt ||
              (recordedDate.getTime() === lockedShipment.latestRecordedAt.getTime() &&
                payload.sequence <= (lastReading?.sequence || 0)));

          // Ingested readings must not overwrite newer latestRecordedAt timestamps
          // and must NEVER revert terminal shipment states (DELIVERED, CANCELLED, RESCUED)
          if (!isStale && !isTerminal) {
            const nextStatus =
              lockedShipment.status === ShipmentStatus.DISPATCHED
                ? ShipmentStatus.IN_TRANSIT
                : undefined;

            await tx.shipment.update({
              where: { id: lockedShipment.id },
              data: {
                latestTemperature: payload.temperature,
                latestHumidity: payload.humidity ?? lockedShipment.latestHumidity,
                latestLat: payload.latitude ?? lockedShipment.latestLat,
                latestLng: payload.longitude ?? lockedShipment.latestLng,
                latestRecordedAt: recordedDate,
                ...(nextStatus ? { status: nextStatus } : {}),
              },
            });
          }
        }
      }

      // Evaluate alerts within the transaction only for current non-stale, non-terminal readings
      let alerts: unknown[] = [];
      if (activeShipment && !isStale && !isTerminal) {
        alerts = await evaluateTelemetryAlerts(activeShipment.id, createdReading, tx);
      }

      return { reading: createdReading, triggeredAlerts: alerts };
    });

    return {
      status: "accepted" as const,
      readingId: reading.id,
      shipmentId: activeShipment?.id ?? null,
      triggeredAlertsCount: triggeredAlerts.length,
      deduplicated: false,
    };
  } catch (err: unknown) {
    // If concurrent insert created the same sequence, catch Prisma P2002 unique constraint violation
    if ((err as { code?: string })?.code === "P2002") {
      const deduplicatedReading = await prisma.telemetryReading.findUnique({
        where: {
          deviceId_sequence: {
            deviceId: device.id,
            sequence: payload.sequence,
          },
        },
      });
      if (deduplicatedReading) {
        return {
          status: "duplicate_ignored" as const,
          readingId: deduplicatedReading.id,
          deduplicated: true,
          shipmentId: deduplicatedReading.shipmentId,
          triggeredAlertsCount: 0,
        };
      }
    }
    throw err;
  }
}
