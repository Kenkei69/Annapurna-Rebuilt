import { prisma } from "../db";
import { ShipmentStatus } from "@prisma/client";
import { recordAuditEvent } from "../audit";

export const ALLOWED_SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.DRAFT]: [ShipmentStatus.DISPATCHED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.DISPATCHED]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCELLED],
  [ShipmentStatus.IN_TRANSIT]: [
    ShipmentStatus.ALERTED,
    ShipmentStatus.RESCUE_PENDING,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.ALERTED]: [
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.RESCUE_PENDING,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.RESCUE_PENDING]: [ShipmentStatus.RESCUED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.RESCUED]: [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.CANCELLED]: [],
};

export function canTransitionShipment(current: ShipmentStatus, target: ShipmentStatus): boolean {
  return ALLOWED_SHIPMENT_TRANSITIONS[current]?.includes(target) ?? false;
}

export function generateTrackingNumber(): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `APN-${dateStr}-${rand}`;
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
  actorId?: string;
  actorEmail?: string;
}) {
  const trackingNumber = generateTrackingNumber();

  return prisma.$transaction(async (tx) => {
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

    if (!shipment) throw new Error("SHIPMENT_NOT_FOUND");

    if (!canTransitionShipment(shipment.status, params.targetStatus)) {
      throw new Error(
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
