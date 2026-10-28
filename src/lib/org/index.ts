import { prisma } from "../db";
import { OrgMemberRole, OrgType, UserRole } from "@prisma/client";

export async function assertOrgAccess(
  userId: string,
  userRole: UserRole,
  organizationId: string,
  allowedMemberRoles?: OrgMemberRole[]
) {
  // Global ADMIN can access all organizations for audit/maintenance
  if (userRole === UserRole.ADMIN) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new Error("ORGANIZATION_NOT_FOUND");
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
    throw new Error("ORG_ACCESS_DENIED");
  }

  if (allowedMemberRoles && !allowedMemberRoles.includes(membership.orgRole)) {
    throw new Error("ORG_ROLE_FORBIDDEN");
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
