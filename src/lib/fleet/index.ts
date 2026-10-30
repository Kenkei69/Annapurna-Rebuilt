import crypto from "crypto";
import { prisma } from "../db";
import { DeviceStatus, VehicleStatus } from "@prisma/client";
import { recordAuditEvent } from "../audit";

export function hashDeviceApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateDeviceApiKey(): string {
  return "dev_key_" + crypto.randomBytes(24).toString("hex");
}

export async function provisionDevice(params: {
  organizationId: string;
  deviceIdentifier: string;
  hardwareModel?: string;
  isSimulated?: boolean;
  actorId?: string;
  actorEmail?: string;
}) {
  const plainApiKey = generateDeviceApiKey();
  const apiKeyHash = hashDeviceApiKey(plainApiKey);

  const isSim =
    params.isSimulated ??
    (params.hardwareModel?.toUpperCase().includes("SIMULATOR") ?? false);

  const device = await prisma.$transaction(async (tx) => {
    const created = await tx.device.create({
      data: {
        organizationId: params.organizationId,
        deviceIdentifier: params.deviceIdentifier,
        hardwareModel: params.hardwareModel || "ANNAPURNA-EDGE-S3",
        isSimulated: isSim,
        apiKeyHash,
        status: DeviceStatus.ACTIVE,
      },
    });

    await recordAuditEvent(
      {
        organizationId: params.organizationId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: "DEVICE_PROVISIONED",
        entityType: "Device",
        entityId: created.id,
        details: {
          deviceIdentifier: created.deviceIdentifier,
          hardwareModel: created.hardwareModel,
        },
      },
      tx
    );

    return created;
  });

  return {
    device,
    plainApiKey, // Exposed once at provisioning time
  };
}

export async function createVehicle(params: {
  organizationId: string;
  licensePlate: string;
  makeModel: string;
  reeferType?: string;
  tempCapabilityMin?: number;
  tempCapabilityMax?: number;
  actorId?: string;
  actorEmail?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.create({
      data: {
        organizationId: params.organizationId,
        licensePlate: params.licensePlate.toUpperCase().trim(),
        makeModel: params.makeModel,
        reeferType: params.reeferType || "STANDARD_REEFER",
        tempCapabilityMin: params.tempCapabilityMin ?? -25.0,
        tempCapabilityMax: params.tempCapabilityMax ?? 25.0,
        status: VehicleStatus.ACTIVE,
      },
    });

    await recordAuditEvent(
      {
        organizationId: params.organizationId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: "VEHICLE_CREATED",
        entityType: "Vehicle",
        entityId: vehicle.id,
        details: { licensePlate: vehicle.licensePlate },
      },
      tx
    );

    return vehicle;
  });
}
