import { prisma } from "../db";
import { OrgMemberRole, OrgType, UserRole } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../errors";

export interface AssertOrgAccessOptions {
  allowedMemberRoles?: OrgMemberRole[];
  mode?: "READ_AUDIT" | "MUTATE_OPERATIONAL";
}

export async function assertOrgAccess(
  userId: string,
  userRole: UserRole,
  organizationId: string,
  optionsOrRoles?: OrgMemberRole[] | AssertOrgAccessOptions
) {
  let allowedMemberRoles: OrgMemberRole[] | undefined;
  let mode: "READ_AUDIT" | "MUTATE_OPERATIONAL" = "MUTATE_OPERATIONAL";

  if (Array.isArray(optionsOrRoles)) {
    allowedMemberRoles = optionsOrRoles;
  } else if (optionsOrRoles) {
    allowedMemberRoles = optionsOrRoles.allowedMemberRoles;
    if (optionsOrRoles.mode) {
      mode = optionsOrRoles.mode;
    }
  }

  // Global ADMIN can read organization data for audit/monitoring,
  // but CANNOT mutate operational records without explicit membership.
  if (userRole === UserRole.ADMIN && mode === "READ_AUDIT") {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundError("ORGANIZATION_NOT_FOUND");
    return { organization: org, membership: null };
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    include: {
      organization: true,
    },
  });

  if (!membership) {
    throw new ForbiddenError(
      "ORG_ACCESS_DENIED: User is not an active member of this organization."
    );
  }

  if (allowedMemberRoles && !allowedMemberRoles.includes(membership.orgRole)) {
    throw new ForbiddenError(
      `ORG_ROLE_FORBIDDEN: Requires member role in [${allowedMemberRoles.join(", ")}].`
    );
  }

  return {
    organization: membership.organization,
    membership,
  };
}

export async function getUserPrimaryOrg(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: {
      organization: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return membership?.organization ?? null;
}

export async function createOrganizationWithAdmin(
  userId: string,
  orgName: string,
  orgType: OrgType = OrgType.FLEET
) {
  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + `-${Date.now().toString(36)}`;

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: orgName,
        slug,
        type: orgType,
      },
    });

    const membership = await tx.membership.create({
      data: {
        userId,
        organizationId: org.id,
        orgRole: OrgMemberRole.OWNER,
      },
    });

    return { org, membership };
  });
}
