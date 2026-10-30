import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertOrgAccess } from "@/lib/org";
import { recordAuditEvent } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { OrgMemberRole } from "@prisma/client";

/**
 * GET /api/org/members
 * List members of the caller's primary organization.
 */
export async function GET(req?: Request) {
  try {
    const user = await requireAuth(req);

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: { organization: { select: { id: true } } },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ members: [] });
    }

    const orgId = membership.organization.id;

    const members = await prisma.membership.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        orgRole: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            // passwordHash intentionally excluded
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ members, organizationId: orgId });
  } catch (err: unknown) {
    console.error("List members error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

const UpdateMemberSchema = z.object({
  memberId: z.string(),
  orgRole: z.nativeEnum(OrgMemberRole),
});

/**
 * PATCH /api/org/members
 * Update a member's org role. Requires OWNER.
 */
export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { memberId, orgRole } = UpdateMemberSchema.parse(body);

    const targetMembership = await prisma.membership.findUnique({
      where: { id: memberId },
      select: { id: true, organizationId: true, userId: true, orgRole: true },
    });

    if (!targetMembership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Only org owners can change roles
    await assertOrgAccess(user.id, user.role, targetMembership.organizationId, ["OWNER"]);

    // Prevent demoting yourself if you're the only owner
    if (targetMembership.userId === user.id && orgRole !== OrgMemberRole.OWNER) {
      const ownerCount = await prisma.membership.count({
        where: { organizationId: targetMembership.organizationId, orgRole: OrgMemberRole.OWNER },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner of an organization" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.membership.update({
        where: { id: memberId },
        data: { orgRole },
        select: {
          id: true,
          orgRole: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      await recordAuditEvent(
        {
          organizationId: targetMembership.organizationId,
          actorId: user.id,
          actorEmail: user.email,
          action: "MEMBER_ROLE_UPDATED",
          entityType: "Membership",
          entityId: memberId,
          details: { previousRole: targetMembership.orgRole, newRole: orgRole },
        },
        tx
      );

      return m;
    });

    return NextResponse.json({ success: true, member: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("Update member error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

const RemoveMemberSchema = z.object({
  memberId: z.string(),
});

/**
 * DELETE /api/org/members
 * Remove a member from the organization. Requires OWNER.
 */
export async function DELETE(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { memberId } = RemoveMemberSchema.parse(body);

    const targetMembership = await prisma.membership.findUnique({
      where: { id: memberId },
      select: { id: true, organizationId: true, userId: true, orgRole: true },
    });

    if (!targetMembership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    await assertOrgAccess(user.id, user.role, targetMembership.organizationId, ["OWNER"]);

    // Prevent removing the last owner
    if (targetMembership.orgRole === OrgMemberRole.OWNER) {
      const ownerCount = await prisma.membership.count({
        where: { organizationId: targetMembership.organizationId, orgRole: OrgMemberRole.OWNER },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner of an organization" },
          { status: 409 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.membership.delete({ where: { id: memberId } });

      await recordAuditEvent(
        {
          organizationId: targetMembership.organizationId,
          actorId: user.id,
          actorEmail: user.email,
          action: "MEMBER_REMOVED",
          entityType: "Membership",
          entityId: memberId,
        },
        tx
      );
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("Remove member error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
