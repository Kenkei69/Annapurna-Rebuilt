import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserPrimaryOrg, assertOrgAccess } from "@/lib/org";
import { provisionDevice } from "@/lib/fleet";
import { UserRole } from "@prisma/client";

const ProvisionSchema = z.object({
  deviceIdentifier: z.string().min(3).max(64),
  hardwareModel: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const primaryOrg = await getUserPrimaryOrg(user.id);
    if (!primaryOrg && user.role !== UserRole.ADMIN) {
      return NextResponse.json({ devices: [] });
    }

    const whereClause: Record<string, unknown> = {};
    if (user.role !== UserRole.ADMIN && primaryOrg) {
      whereClause.organizationId = primaryOrg.id;
    }

    const devices = await prisma.device.findMany({
      where: whereClause,
      select: {
        id: true,
        organizationId: true,
        deviceIdentifier: true,
        hardwareModel: true,
        status: true,
        isSimulated: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
        shipments: {
          where: { status: { in: ["DISPATCHED", "IN_TRANSIT", "ALERTED", "RESCUE_PENDING"] } },
          select: { id: true, trackingNumber: true, title: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ devices });
  } catch (err: unknown) {
    console.error("List devices error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const primaryOrg = await getUserPrimaryOrg(user.id);
    if (!primaryOrg) {
      return NextResponse.json({ error: "No organization associated with user" }, { status: 400 });
    }

    await assertOrgAccess(user.id, user.role, primaryOrg.id, ["OWNER", "DISPATCHER"]);

    const body = await req.json();
    const data = ProvisionSchema.parse(body);

    const result = await provisionDevice({
      organizationId: primaryOrg.id,
      deviceIdentifier: data.deviceIdentifier.toUpperCase().trim(),
      hardwareModel: data.hardwareModel,
      actorId: user.id,
      actorEmail: user.email,
    });

    return NextResponse.json({
      success: true,
      device: result.device,
      apiKey: result.plainApiKey, // Displayed once for edge flash
    }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Provision device error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
