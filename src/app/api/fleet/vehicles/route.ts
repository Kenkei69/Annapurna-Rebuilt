import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserPrimaryOrg, assertOrgAccess } from "@/lib/org";
import { createVehicle } from "@/lib/fleet";
import { UserRole } from "@prisma/client";

const VehicleSchema = z.object({
  licensePlate: z.string().min(3).max(20),
  makeModel: z.string().min(2),
  reeferType: z.string().optional(),
  tempCapabilityMin: z.number().optional(),
  tempCapabilityMax: z.number().optional(),
});

export async function GET() {
  try {
    const user = await requireAuth();
    const primaryOrg = await getUserPrimaryOrg(user.id);
    if (!primaryOrg && user.role !== UserRole.ADMIN) {
      return NextResponse.json({ vehicles: [] });
    }

    const whereClause: Record<string, unknown> = {};
    if (user.role !== UserRole.ADMIN && primaryOrg) {
      whereClause.organizationId = primaryOrg.id;
    }

    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
      include: {
        shipments: {
          where: { status: { in: ["DISPATCHED", "IN_TRANSIT", "ALERTED", "RESCUE_PENDING"] } },
          select: { id: true, trackingNumber: true, title: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ vehicles });
  } catch (err: unknown) {
    console.error("List vehicles error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const primaryOrg = await getUserPrimaryOrg(user.id);
    if (!primaryOrg) {
      return NextResponse.json({ error: "No organization associated with user" }, { status: 400 });
    }

    await assertOrgAccess(user.id, user.role, primaryOrg.id, ["OWNER", "DISPATCHER"]);

    const body = await req.json();
    const data = VehicleSchema.parse(body);

    const vehicle = await createVehicle({
      organizationId: primaryOrg.id,
      licensePlate: data.licensePlate,
      makeModel: data.makeModel,
      reeferType: data.reeferType,
      tempCapabilityMin: data.tempCapabilityMin,
      tempCapabilityMax: data.tempCapabilityMax,
      actorId: user.id,
      actorEmail: user.email,
    });

    return NextResponse.json({ success: true, vehicle }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Create vehicle error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
