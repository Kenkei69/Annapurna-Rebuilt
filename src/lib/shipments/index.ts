import { prisma } from "../db";
import { ShipmentStatus } from "@prisma/client";
import { recordAuditEvent } from "../audit";
import { canTransitionShipment } from "../lifecycle";
import { NotFoundError, ConflictError, ValidationError } from "../errors";

export { canTransitionShipment };

export function generateTrackingNumber(): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const entropy = Math.random().toString(36).slice(2, 6).toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `APN-${dateStr}-${entropy}${rand}`;
}

export async function createShipment(params: {
  organizationId: string;
  title: string;
  cargoType: string;
  tempMin: number;
  tempMax: number;
  humidityMin?: number;
  humidityMax?: number;
  originName: string;
  originLat?: number;
  originLng?: number;
  destName: string;
  destLat?: number;
  destLng?: number;
  assignedVehicleId?: string;
  assignedDeviceId?: string;
  assignedDriverId?: string;
  cargoWeightKg?: number;
  actorId?: string;
  actorEmail?: string;
}) {
  if (params.tempMin >= params.tempMax) {
    throw new ValidationError("tempMin must be strictly less than tempMax.");
  }

  const trackingNumber = generateTrackingNumber();

  return prisma.$transaction(async (tx) => {
    // Validate vehicle belongs to same organization
    if (params.assignedVehicleId) {
      const v = await tx.vehicle.findUnique({
        where: { id: params.assignedVehicleId },
        select: { organizationId: true },
      });
      if (!v || v.organizationId !== params.organizationId) {
        throw new ValidationError("Assigned vehicle does not belong to the shipment's organization.");
      }
    }

    // Validate device belongs to same organization
    if (params.assignedDeviceId) {
      const d = await tx.device.findUnique({
        where: { id: params.assignedDeviceId },
        select: { organizationId: true },
      });
      if (!d || d.organizationId !== params.organizationId) {
        throw new ValidationError("Assigned device does not belong to the shipment's organization.");
      }
    }

    // Validate driver belongs to same organization
    if (params.assignedDriverId) {
      const m = await tx.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: params.assignedDriverId,
            organizationId: params.organizationId,
          },
        },
      });
      if (!m) {
        throw new ValidationError("Assigned driver is not a member of the shipment's organization.");
      }
    }

    const shipment = await tx.shipment.create({
      data: {
        organizationId: params.organizationId,
        trackingNumber,
        title: params.title,
        cargoType: params.cargoType,
        tempMin: params.tempMin,
        tempMax: params.tempMax,
        humidityMin: params.humidityMin,
        humidityMax: params.humidityMax,
        originName: params.originName,
        originLat: params.originLat,
        originLng: params.originLng,
        destName: params.destName,
        destLat: params.destLat,
        destLng: params.destLng,
        assignedVehicleId: params.assignedVehicleId,
        assignedDeviceId: params.assignedDeviceId,
        assignedDriverId: params.assignedDriverId,
        cargoWeightKg: params.cargoWeightKg ?? 1000.0,
        status: params.assignedVehicleId && params.assignedDeviceId
          ? ShipmentStatus.DISPATCHED
          : ShipmentStatus.DRAFT,
      },
    });

    await recordAuditEvent(
      {
        organizationId: params.organizationId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: "SHIPMENT_CREATED",
        entityType: "Shipment",
        entityId: shipment.id,
        details: {
          trackingNumber: shipment.trackingNumber,
          cargoType: shipment.cargoType,
          status: shipment.status,
        },
      },
      tx
    );

    return shipment;
  });
}

export async function transitionShipmentStatus(params: {
  shipmentId: string;
  targetStatus: ShipmentStatus;
  actorId?: string;
  actorEmail?: string;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: params.shipmentId },
    });

    if (!shipment) throw new NotFoundError("SHIPMENT_NOT_FOUND");

    if (!canTransitionShipment(shipment.status, params.targetStatus)) {
      throw new ConflictError(
        `INVALID_TRANSITION: Cannot transition shipment from ${shipment.status} to ${params.targetStatus}`
      );
    }

    const updated = await tx.shipment.update({
      where: { id: params.shipmentId },
      data: { status: params.targetStatus },
    });

    await recordAuditEvent(
      {
        organizationId: shipment.organizationId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: "SHIPMENT_STATUS_TRANSITION",
        entityType: "Shipment",
        entityId: shipment.id,
        details: {
          from: shipment.status,
          to: params.targetStatus,
          notes: params.notes,
        },
      },
      tx
    );

    return updated;
  });
}
