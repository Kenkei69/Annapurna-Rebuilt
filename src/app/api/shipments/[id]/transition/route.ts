import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { transitionShipmentStatus } from "@/lib/shipments";
import { assertOrgAccess } from "@/lib/org";
import { prisma } from "@/lib/db";
import { ShipmentStatus, UserRole } from "@prisma/client";

const TransitionSchema = z.object({
  targetStatus: z.nativeEnum(ShipmentStatus),
  notes: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const { targetStatus, notes } = TransitionSchema.parse(body);

    const shipment = await prisma.shipment.findUnique({
      where: { id },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Drivers can only update progress/milestones, not cancel or change to draft
    if (user.role === UserRole.DRIVER) {
      if (shipment.assignedDriverId !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (targetStatus !== ShipmentStatus.DELIVERED) {
        return NextResponse.json({ error: "Drivers can only mark shipments delivered" }, { status: 403 });
      }
    } else {
      await assertOrgAccess(user.id, user.role, shipment.organizationId, ["OWNER", "DISPATCHER"]);
    }

    const updated = await transitionShipmentStatus({
      shipmentId: id,
      targetStatus,
      actorId: user.id,
      actorEmail: user.email,
      notes,
    });

    return NextResponse.json({ success: true, shipment: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Transition error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
