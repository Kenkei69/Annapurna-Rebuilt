import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertOrgAccess } from "@/lib/org";
import { recordAuditEvent } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { DeviceStatus } from "@prisma/client";

const UpdateDeviceSchema = z.object({
  status: z.nativeEnum(DeviceStatus),
  reason: z.string().min(3).max(500),
});

/**
 * PATCH /api/devices/[id]
 * Update device status (suspend or decommission). Requires OWNER or DISPATCHER role.
 * Only ACTIVE -> SUSPENDED and ACTIVE/SUSPENDED -> DECOMMISSIONED are allowed.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const { status: newStatus, reason } = UpdateDeviceSchema.parse(body);

    const device = await prisma.device.findUnique({
      where: { id },
      select: { id: true, organizationId: true, status: true, deviceIdentifier: true },
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    await assertOrgAccess(user.id, user.role, device.organizationId, ["OWNER", "DISPATCHER"]);

    // Status transition validation
    const allowed: Partial<Record<DeviceStatus, DeviceStatus[]>> = {
      ACTIVE: [DeviceStatus.SUSPENDED, DeviceStatus.DECOMMISSIONED],
      SUSPENDED: [DeviceStatus.ACTIVE, DeviceStatus.DECOMMISSIONED],
      DECOMMISSIONED: [],
    };

    if (!allowed[device.status]?.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition device from ${device.status} to ${newStatus}` },
        { status: 409 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.device.update({
        where: { id },
        data: { status: newStatus },
        select: {
          id: true,
          deviceIdentifier: true,
          hardwareModel: true,
          status: true,
          isSimulated: true,
          lastSeenAt: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          // apiKeyHash intentionally excluded
        },
      });

      await recordAuditEvent(
        {
          organizationId: device.organizationId,
          actorId: user.id,
          actorEmail: user.email,
          action: `DEVICE_STATUS_CHANGED_TO_${newStatus}`,
          entityType: "Device",
          entityId: id,
          details: {
            previousStatus: device.status,
            newStatus,
            reason,
            deviceIdentifier: device.deviceIdentifier,
          },
        },
        tx
      );

      return d;
    });

    return NextResponse.json({ success: true, device: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("Update device error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/devices/[id]
 * Get single device details. Requires org membership.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const device = await prisma.device.findUnique({
      where: { id },
      select: {
        id: true,
        deviceIdentifier: true,
        hardwareModel: true,
        status: true,
        isSimulated: true,
        lastSeenAt: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        // apiKeyHash intentionally excluded
        shipments: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            trackingNumber: true,
            title: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    await assertOrgAccess(user.id, user.role, device.organizationId, undefined);

    return NextResponse.json({ device });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("Get device error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
