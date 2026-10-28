import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { assertOrgAccess } from "@/lib/org";
import { UserRole } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        organization: true,
        assignedVehicle: true,
        assignedDevice: true,
        assignedDriver: { select: { id: true, name: true, email: true } },
        alerts: {
          orderBy: { createdAt: "desc" },
          include: {
            acknowledgedBy: { select: { id: true, name: true, email: true } },
            resolvedBy: { select: { id: true, name: true, email: true } },
          },
        },
        rescueOpportunity: {
          include: {
            offers: {
              include: {
                partnerOrg: true,
                submittedBy: { select: { id: true, name: true, email: true } },
              },
            },
            milestones: {
              include: {
                actor: { select: { id: true, name: true, email: true } },
              },
              orderBy: { recordedAt: "asc" },
            },
          },
        },
        telemetryReadings: {
          orderBy: { recordedAt: "desc" },
          take: 60,
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Role and Organization Authorization
    if (user.role === UserRole.DRIVER && shipment.assignedDriverId !== user.id) {
      return NextResponse.json({ error: "Access denied: Shipment not assigned to you." }, { status: 403 });
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.PARTNER) {
      await assertOrgAccess(user.id, user.role, shipment.organizationId);
    }

    return NextResponse.json({ shipment });
  } catch (err: unknown) {
    console.error("Get shipment error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
