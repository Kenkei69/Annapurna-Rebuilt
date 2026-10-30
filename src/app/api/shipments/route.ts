import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getAuthorizedActor, getShipmentsWhereClause } from "@/lib/auth/policy";
import { createShipment } from "@/lib/shipments";
import { assertOrgAccess, getUserPrimaryOrg } from "@/lib/org";
import { ShipmentStatus } from "@prisma/client";

const CreateShipmentSchema = z.object({
  title: z.string().min(3),
  cargoType: z.string().min(2),
  tempMin: z.number(),
  tempMax: z.number(),
  humidityMin: z.number().optional(),
  humidityMax: z.number().optional(),
  originName: z.string().min(2),
  originLat: z.number().optional(),
  originLng: z.number().optional(),
  destName: z.string().min(2),
  destLat: z.number().optional(),
  destLng: z.number().optional(),
  assignedVehicleId: z.string().optional(),
  assignedDeviceId: z.string().optional(),
  assignedDriverId: z.string().optional(),
  cargoWeightKg: z.number().positive().optional(),
  organizationId: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const actor = await getAuthorizedActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status") as ShipmentStatus | null;
    const searchParam = url.searchParams.get("search") || "";

    const baseWhere = getShipmentsWhereClause(actor);
    const whereClause: Record<string, unknown> = { ...baseWhere };

    if (statusParam) {
      whereClause.status = statusParam;
    }

    if (searchParam) {
      whereClause.OR = [
        { title: { contains: searchParam, mode: "insensitive" } },
        { trackingNumber: { contains: searchParam, mode: "insensitive" } },
        { cargoType: { contains: searchParam, mode: "insensitive" } },
      ];
    }

    const shipments = await prisma.shipment.findMany({
      where: whereClause,
      select: {
        id: true,
        organizationId: true,
        trackingNumber: true,
        title: true,
        cargoType: true,
        tempMin: true,
        tempMax: true,
        status: true,
        originName: true,
        destName: true,
        latestTemperature: true,
        latestRecordedAt: true,
        createdAt: true,
        updatedAt: true,
        assignedVehicle: {
          select: {
            id: true,
            licensePlate: true,
            makeModel: true,
            reeferType: true,
            status: true,
          },
        },
        assignedDevice: {
          // Safe projection: NO apiKeyHash!
          select: {
            id: true,
            deviceIdentifier: true,
            hardwareModel: true,
            status: true,
            lastSeenAt: true,
          },
        },
        assignedDriver: {
          // Safe projection: NO passwordHash!
          select: { id: true, name: true, email: true },
        },
        alerts: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            ruleCode: true,
            severity: true,
            status: true,
            summary: true,
          },
        },
        rescueOpportunity: {
          select: {
            id: true,
            status: true,
            title: true,
            urgency: true,
            acceptedOfferId: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ shipments });
  } catch (err: unknown) {
    console.error("List shipments error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const data = CreateShipmentSchema.parse(body);

    const primaryOrg = await getUserPrimaryOrg(user.id);
    const targetOrgId = data.organizationId || primaryOrg?.id;

    if (!targetOrgId) {
      return NextResponse.json({ error: "Missing organization context" }, { status: 400 });
    }

    await assertOrgAccess(user.id, user.role, targetOrgId, ["OWNER", "DISPATCHER"]);

    if (data.tempMin >= data.tempMax) {
      return NextResponse.json(
        { error: "tempMin must be strictly less than tempMax" },
        { status: 400 }
      );
    }

    // Verify assigned vehicle & device belong to the same organization
    if (data.assignedVehicleId) {
      const v = await prisma.vehicle.findUnique({
        where: { id: data.assignedVehicleId },
      });
      if (!v || v.organizationId !== targetOrgId) {
        return NextResponse.json({ error: "Vehicle not found in organization" }, { status: 400 });
      }
    }

    if (data.assignedDeviceId) {
      const d = await prisma.device.findUnique({
        where: { id: data.assignedDeviceId },
      });
      if (!d || d.organizationId !== targetOrgId) {
        return NextResponse.json({ error: "Device not found in organization" }, { status: 400 });
      }
    }

    const shipment = await createShipment({
      organizationId: targetOrgId,
      title: data.title,
      cargoType: data.cargoType,
      tempMin: data.tempMin,
      tempMax: data.tempMax,
      humidityMin: data.humidityMin,
      humidityMax: data.humidityMax,
      originName: data.originName,
      originLat: data.originLat,
      originLng: data.originLng,
      destName: data.destName,
      destLat: data.destLat,
      destLng: data.destLng,
      assignedVehicleId: data.assignedVehicleId,
      assignedDeviceId: data.assignedDeviceId,
      assignedDriverId: data.assignedDriverId,
      cargoWeightKg: data.cargoWeightKg,
      actorId: user.id,
      actorEmail: user.email,
    });

    return NextResponse.json({ success: true, shipment }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Create shipment error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
