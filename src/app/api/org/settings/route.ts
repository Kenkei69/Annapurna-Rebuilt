import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertOrgAccess } from "@/lib/org";
import { recordAuditEvent } from "@/lib/audit";
import { AppError } from "@/lib/errors";

/**
 * GET /api/org/settings
 * Get organization profile settings for the caller's primary org.
 */
export async function GET(req?: Request) {
  try {
    const user = await requireAuth(req);

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            createdAt: true,
            updatedAt: true,
            partnerProfile: {
              select: {
                id: true,
                facilityName: true,
                facilityType: true,
                address: true,
                capacityAvailableKg: true,
                tempRangeMin: true,
                tempRangeMax: true,
                contactEmail: true,
                contactPhone: true,
                onboardingComplete: true,
                isActive: true,
                verificationStatus: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    return NextResponse.json({ organization: membership.organization, orgRole: membership.orgRole });
  } catch (err: unknown) {
    console.error("Get org settings error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

const UpdateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
});

/**
 * PATCH /api/org/settings
 * Update organization name. Requires OWNER.
 */
export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const data = UpdateOrgSchema.parse(body);

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: { organization: { select: { id: true } } },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const orgId = membership.organization.id;
    await assertOrgAccess(user.id, user.role, orgId, ["OWNER"]);

    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.organization.update({
        where: { id: orgId },
        data: { ...(data.name && { name: data.name }) },
        select: { id: true, name: true, slug: true, type: true, updatedAt: true },
      });

      await recordAuditEvent(
        {
          organizationId: orgId,
          actorId: user.id,
          actorEmail: user.email,
          action: "ORGANIZATION_UPDATED",
          entityType: "Organization",
          entityId: orgId,
          details: data,
        },
        tx
      );

      return o;
    });

    return NextResponse.json({ success: true, organization: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("Update org settings error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
