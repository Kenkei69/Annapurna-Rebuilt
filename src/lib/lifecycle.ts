import { ShipmentStatus, RescueStatus, OfferStatus } from "@prisma/client";

/**
 * Centralized State Machine Transitions & Invariants
 */

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
    ShipmentStatus.IN_TRANSIT, // When all alerts are resolved
    ShipmentStatus.RESCUE_PENDING, // When rescue opportunity is initiated
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.RESCUE_PENDING]: [
    ShipmentStatus.RESCUED, // When rescue is completed
    ShipmentStatus.ALERTED, // If rescue is cancelled without completion
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.RESCUED]: [
    ShipmentStatus.DELIVERED, // Transferred to final destination/depot
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.DELIVERED]: [], // Terminal state
  [ShipmentStatus.CANCELLED]: [], // Terminal state
};

export function canTransitionShipment(
  current: ShipmentStatus,
  target: ShipmentStatus
): boolean {
  if (current === target) return true; // Idempotent no-op
  return ALLOWED_SHIPMENT_TRANSITIONS[current]?.includes(target) ?? false;
}

export const ALLOWED_RESCUE_TRANSITIONS: Record<RescueStatus, RescueStatus[]> = {
  [RescueStatus.OPEN]: [RescueStatus.OFFERED, RescueStatus.CANCELLED],
  [RescueStatus.OFFERED]: [
    RescueStatus.ACCEPTED,
    RescueStatus.CANCELLED,
  ],
  [RescueStatus.ACCEPTED]: [
    RescueStatus.IN_PROGRESS,
    RescueStatus.COMPLETED,
    RescueStatus.CANCELLED,
  ],
  [RescueStatus.IN_PROGRESS]: [
    RescueStatus.COMPLETED,
    RescueStatus.CANCELLED,
  ],
  [RescueStatus.COMPLETED]: [], // Terminal state
  [RescueStatus.CANCELLED]: [], // Terminal state
};

export function canTransitionRescue(
  current: RescueStatus,
  target: RescueStatus
): boolean {
  if (current === target) return true;
  return ALLOWED_RESCUE_TRANSITIONS[current]?.includes(target) ?? false;
}

export const ALLOWED_OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  [OfferStatus.SUBMITTED]: [OfferStatus.ACCEPTED, OfferStatus.REJECTED, OfferStatus.EXPIRED],
  [OfferStatus.ACCEPTED]: [],
  [OfferStatus.REJECTED]: [],
  [OfferStatus.EXPIRED]: [],
};

export function canTransitionOffer(
  current: OfferStatus,
  target: OfferStatus
): boolean {
  if (current === target) return true;
  return ALLOWED_OFFER_TRANSITIONS[current]?.includes(target) ?? false;
}

export const VALID_RESCUE_MILESTONES = [
  "OFFER_ACCEPTED",
  "EN_ROUTE_TO_CARGO",
  "ARRIVED_AT_SCENE",
  "TRANSFER_DISPATCHED",
  "TRANSFER_IN_PROGRESS",
  "CARGO_SECURED_SAFE",
  "RESCUE_COMPLETED",
  "RESCUE_ABORTED",
] as const;

export type ValidRescueMilestone = (typeof VALID_RESCUE_MILESTONES)[number];

export function isValidRescueMilestone(type: string): type is ValidRescueMilestone {
  return VALID_RESCUE_MILESTONES.includes(type as ValidRescueMilestone);
}
