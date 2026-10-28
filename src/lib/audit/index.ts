import { prisma } from "../db";
import { Prisma } from "@prisma/client";

export interface AuditParams {
  organizationId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function recordAuditEvent(
  params: AuditParams,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.auditEvent.create({
    data: {
      organizationId: params.organizationId ?? null,
      actorId: params.actorId ?? null,
      actorEmail: params.actorEmail ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      detailsJson: params.details ? JSON.stringify(params.details) : null,
      ipAddress: params.ipAddress ?? null,
    },
  });
}
