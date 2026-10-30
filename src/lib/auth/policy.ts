import { prisma } from "../db";
import { UserRole, OrgType, RescueStatus, OfferStatus } from "@prisma/client";
import { getCurrentUser } from "./index";
import { ForbiddenError, NotFoundError } from "../errors";

export interface AuthorizedActor {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  primaryOrgId: string | null;
  primaryOrgType: OrgType | null;
  memberOrgIds: string[];
}

export type ShipmentAccessLevel =
  | "FLEET_OPERATOR"
  | "ASSIGNED_DRIVER"
  | "RESCUE_PARTNER_ASSIGNED"
  | "RESCUE_PARTNER_BIDDING"
  | "PLATFORM_ADMIN_AUDIT";

export interface ShipmentAccessResult {
  allowed: boolean;
  accessLevel?: ShipmentAccessLevel;
  reason?: string;
  shipmentMeta?: {
    id: string;
    organizationId: string;
    assignedDriverId: string | null;
    status: string;
  };
}

/**
 * Resolves full authorized actor identity and verified organization memberships from trusted DB records.
 */
export async function resolveActor(userId: string): Promise<AuthorizedActor | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      memberships: {
        select: {
          organizationId: true,
          orgRole: true,
          organization: {
            select: { id: true, type: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) return null;

  const memberOrgIds = user.memberships.map((m) => m.organizationId);
  const primaryMembership = user.memberships[0] || null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    primaryOrgId: primaryMembership ? primaryMembership.organizationId : null,
    primaryOrgType: primaryMembership ? primaryMembership.organization.type : null,
    memberOrgIds,
  };
}

/**
 * Resolves current actor from the request session.
 */
export async function getAuthorizedActor(req?: Request): Promise<AuthorizedActor | null> {
  const user = await getCurrentUser(req);
  if (!user) return null;
  return resolveActor(user.id);
}

/**
 * Shared authorization policy evaluating whether an actor has permission to access a specific shipment.
 * Queries ONLY minimal metadata required for policy decision before loading relations.
 */
export async function authorizeShipmentAccess(
  actor: AuthorizedActor,
  shipmentId: string
): Promise<ShipmentAccessResult> {
  const meta = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      organizationId: true,
      assignedDriverId: true,
      status: true,
      rescueOpportunity: {
        select: {
          id: true,
          status: true,
          acceptedOfferId: true,
          offers: {
            select: { id: true, partnerOrgId: true, status: true },
          },
        },
      },
    },
  });

  if (!meta) {
    return { allowed: false, reason: "NOT_FOUND" };
  }

  // 1. Platform Admin: Audit visibility only
  if (actor.role === UserRole.ADMIN) {
    return {
      allowed: true,
      accessLevel: "PLATFORM_ADMIN_AUDIT",
      shipmentMeta: meta,
    };
  }

  // 2. Fleet Operator: Must belong to shipment's organization
  if (actor.role === UserRole.OPERATOR) {
    if (actor.memberOrgIds.includes(meta.organizationId)) {
      return {
        allowed: true,
        accessLevel: "FLEET_OPERATOR",
        shipmentMeta: meta,
      };
    }
    return { allowed: false, reason: "CROSS_TENANT_FORBIDDEN" };
  }

  // 3. Driver: MUST belong to organization AND be the assigned driver
  if (actor.role === UserRole.DRIVER) {
    if (
      actor.memberOrgIds.includes(meta.organizationId) &&
      meta.assignedDriverId === actor.userId
    ) {
      return {
        allowed: true,
        accessLevel: "ASSIGNED_DRIVER",
        shipmentMeta: meta,
      };
    }
    return {
      allowed: false,
      reason: "DRIVER_NOT_ASSIGNED_OR_CROSS_ORG",
    };
  }

  // 4. Rescue Partner: Only permitted if eligible for rescue bidding or assigned winner
  if (actor.role === UserRole.PARTNER && actor.primaryOrgId) {
    const opp = meta.rescueOpportunity;
    if (!opp) {
      return {
        allowed: false,
        reason: "NO_RESCUE_OPPORTUNITY_FOR_PARTNER",
      };
    }

    const partnerOrgId = actor.primaryOrgId;

    // Check if partner is the winning accepted assignment
    const winningOffer = opp.offers.find(
      (o) => o.id === opp.acceptedOfferId && o.status === OfferStatus.ACCEPTED
    );

    // If opportunity has transitioned to ACCEPTED, IN_PROGRESS, COMPLETED, or CANCELLED:
    // ONLY the winning partner org is authorized to access shipment details.
    if (
      opp.status === RescueStatus.ACCEPTED ||
      opp.status === RescueStatus.IN_PROGRESS ||
      opp.status === RescueStatus.COMPLETED ||
      opp.status === RescueStatus.CANCELLED
    ) {
      if (winningOffer && winningOffer.partnerOrgId === partnerOrgId) {
        return {
          allowed: true,
          accessLevel: "RESCUE_PARTNER_ASSIGNED",
          shipmentMeta: meta,
        };
      }
      return {
        allowed: false,
        reason: "PARTNER_UNAUTHORIZED_FOR_COMPLETED_OR_UNASSIGNED_RESCUE",
      };
    }

    // Opportunity is in OPEN or OFFERED status: active rescue bidding window
    if (opp.status === RescueStatus.OPEN || opp.status === RescueStatus.OFFERED) {
      return {
        allowed: true,
        accessLevel: "RESCUE_PARTNER_BIDDING",
        shipmentMeta: meta,
      };
    }

    return {
      allowed: false,
      reason: "PARTNER_UNAUTHORIZED_FOR_COMPLETED_OR_UNASSIGNED_RESCUE",
    };
  }

  return { allowed: false, reason: "INSUFFICIENT_PERMISSIONS" };
}

/**
 * Loads shipment data with safe projections and role-based field sanitization.
 * Never serializes passwordHash, apiKeyHash, or competitor offers.
 */
export async function loadAuthorizedShipmentDetails(
  actor: AuthorizedActor,
  shipmentId: string
) {
  const auth = await authorizeShipmentAccess(actor, shipmentId);
  if (!auth.allowed) {
    if (auth.reason === "NOT_FOUND") {
      throw new NotFoundError("Shipment not found");
    }
    throw new ForbiddenError(
      `Access denied: You do not have permission to view this shipment (${auth.reason}).`
    );
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      organizationId: true,
      trackingNumber: true,
      title: true,
      cargoType: true,
      tempMin: true,
      tempMax: true,
      humidityMin: true,
      humidityMax: true,
      status: true,
      originName: true,
      originLat: true,
      originLng: true,
      destName: true,
      destLat: true,
      destLng: true,
      latestTemperature: true,
      latestHumidity: true,
      latestLat: true,
      latestLng: true,
      latestRecordedAt: true,
      cargoWeightKg: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: { id: true, name: true, slug: true, type: true },
      },
      assignedVehicle: {
        select: {
          id: true,
          licensePlate: true,
          makeModel: true,
          reeferType: true,
          tempCapabilityMin: true,
          tempCapabilityMax: true,
          status: true,
        },
      },
      assignedDevice: {
        // Safe device projection: EXCLUDES apiKeyHash!
        select: {
          id: true,
          deviceIdentifier: true,
          hardwareModel: true,
          status: true,
          lastSeenAt: true,
        },
      },
      assignedDriver: {
        // Safe driver projection: EXCLUDES passwordHash!
        select: { id: true, name: true, email: true },
      },
      alerts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          ruleCode: true,
          severity: true,
          status: true,
          summary: true,
          triggerReadingJson: true,
          recommendedAction: true,
          acknowledgedAt: true,
          ackNotes: true,
          resolvedAt: true,
          resolutionNotes: true,
          createdAt: true,
          // Safe user projections: EXCLUDES passwordHash!
          acknowledgedBy: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true, email: true } },
        },
      },
      rescueOpportunity: {
        select: {
          id: true,
          title: true,
          cargoDescription: true,
          cargoWeightKg: true,
          tempRequirementMin: true,
          tempRequirementMax: true,
          urgency: true,
          targetLat: true,
          targetLng: true,
          maxBudget: true,
          status: true,
          acceptedOfferId: true,
          createdAt: true,
          offers: {
            select: {
              id: true,
              partnerOrgId: true,
              offerAmount: true,
              capacityOfferedKg: true,
              storageType: true,
              estimatedEtaMinutes: true,
              status: true,
              notes: true,
              counterAmount: true,
              counterNotes: true,
              counteredAt: true,
              counterStatus: true,
              isPartnerApproved: true,
              createdAt: true,
              partnerOrg: { select: { id: true, name: true, slug: true } },
              submittedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          milestones: {
            select: {
              id: true,
              milestoneType: true,
              notes: true,
              recordedAt: true,
              // Safe actor projection: EXCLUDES passwordHash!
              actor: { select: { id: true, name: true, email: true } },
            },
            orderBy: { recordedAt: "asc" },
          },
        },
      },
      telemetryReadings: {
        orderBy: { recordedAt: "desc" },
        take: 60,
        select: {
          id: true,
          sequence: true,
          recordedAt: true,
          temperature: true,
          humidity: true,
          latitude: true,
          longitude: true,
          batteryPct: true,
          isSimulated: true,
        },
      },
      photos: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSizeBytes: true,
          widthPx: true,
          heightPx: true,
          caption: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      },
      assessments: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          riskLevel: true,
          summary: true,
          advisoryQuestion: true,
          language: true,
          source: true,
          suggestedActions: true,
          draftDriverUpdate: true,
          uncertaintyNotes: true,
          warmingVelocity: true,
          estimatedMinutes: true,
          createdAt: true,
        },
      },
    },
  });

  if (!shipment) {
    throw new NotFoundError("Shipment not found");
  }

  // Role-based DTO sanitization
  const safeShipment = { ...shipment };

  // 1. Sanitization for Rescue Partners
  if (
    auth.accessLevel === "RESCUE_PARTNER_BIDDING" ||
    auth.accessLevel === "RESCUE_PARTNER_ASSIGNED"
  ) {
    if (safeShipment.rescueOpportunity) {
      // Competitor offer isolation: Partner can ONLY see their own organization's offers
      safeShipment.rescueOpportunity = {
        ...safeShipment.rescueOpportunity,
        offers: safeShipment.rescueOpportunity.offers.filter(
          (o) => o.partnerOrgId === actor.primaryOrgId
        ),
      };

      // If merely bidding, redact fleet internal maxBudget to prevent price sniping
      if (auth.accessLevel === "RESCUE_PARTNER_BIDDING") {
        safeShipment.rescueOpportunity.maxBudget = null;
        safeShipment.photos = [];
      }
    }

    // Partner does not need internal IoT device metadata
    safeShipment.assignedDevice = null;
  }

  // 2. Sanitization for Assigned Driver
  if (auth.accessLevel === "ASSIGNED_DRIVER") {
    if (safeShipment.rescueOpportunity) {
      // Driver sees rescue status and milestones, but not partner financial bids
      safeShipment.rescueOpportunity = {
        ...safeShipment.rescueOpportunity,
        offers: [],
        maxBudget: null,
      };
    }
  }

  return {
    shipment: safeShipment,
    accessLevel: auth.accessLevel,
  };
}

/**
 * Failsafe Shipment where-clause builder for list endpoints.
 * Never builds an unrestricted query when membership/org is missing.
 */
export function getShipmentsWhereClause(actor: AuthorizedActor) {
  // If user has no organization context and is not admin -> FAIL CLOSED (zero results)
  if (!actor.primaryOrgId && actor.role !== UserRole.ADMIN) {
    return { id: "FAIL_CLOSED_NO_ACCESS" };
  }

  // Fleet Operator: Confined strictly to primary organization
  if (actor.role === UserRole.OPERATOR) {
    return { organizationId: actor.primaryOrgId! };
  }

  // Driver: Confined strictly to primary organization AND assigned shipments
  if (actor.role === UserRole.DRIVER) {
    return {
      organizationId: actor.primaryOrgId!,
      assignedDriverId: actor.userId,
    };
  }

  // Rescue Partner: Only sees shipments with open rescue requests or where they submitted an offer
  if (actor.role === UserRole.PARTNER) {
    return {
      rescueOpportunity: {
        OR: [
          { status: { in: [RescueStatus.OPEN, RescueStatus.OFFERED] } },
          { offers: { some: { partnerOrgId: actor.primaryOrgId! } } },
        ],
      },
    };
  }

  // Platform Admin: Audit visibility
  return {};
}

/**
 * Failsafe Rescue Opportunity where-clause builder for list endpoints.
 */
export function getRescueOpportunitiesWhereClause(actor: AuthorizedActor) {
  if (!actor.primaryOrgId && actor.role !== UserRole.ADMIN) {
    return { id: "FAIL_CLOSED_NO_ACCESS" };
  }

  if (actor.role === UserRole.OPERATOR) {
    return { organizationId: actor.primaryOrgId! };
  }

  if (actor.role === UserRole.DRIVER) {
    return {
      shipment: {
        assignedDriverId: actor.userId,
      },
    };
  }

  if (actor.role === UserRole.PARTNER) {
    return {
      OR: [
        { status: { in: [RescueStatus.OPEN, RescueStatus.OFFERED] } },
        { offers: { some: { partnerOrgId: actor.primaryOrgId! } } },
      ],
    };
  }

  return {};
}
