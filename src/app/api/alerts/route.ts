import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/org";
import { AlertStatus, UserRole } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as AlertStatus | null;
    const shipmentId = url.searchParams.get("shipmentId");

    const primaryOrg = await getUserPrimaryOrg(user.id);
    if (!primaryOrg && user.role !== UserRole.ADMIN) {
      return NextResponse.json({ alerts: [] });
    }

    const whereClause: Record<string, unknown> = {};

    if (user.role !== UserRole.ADMIN) {
      whereClause.organizationId = primaryOrg?.id;
    }

    if (status) {
      whereClause.status = status;
    }

    if (shipmentId) {
      whereClause.shipmentId = shipmentId;
    }

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            title: true,
            cargoType: true,
            tempMin: true,
            tempMax: true,
            status: true,
          },
        },
        acknowledgedBy: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({ alerts });
  } catch (err: unknown) {
    console.error("List alerts error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
