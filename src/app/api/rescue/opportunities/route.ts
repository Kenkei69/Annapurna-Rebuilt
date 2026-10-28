import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getAuthorizedActor, getRescueOpportunitiesWhereClause } from "@/lib/auth/policy";
import { createRescueOpportunity } from "@/lib/rescue";
import { assertOrgAccess } from "@/lib/org";
import { UserRole } from "@prisma/client";
import { AppError } from "@/lib/errors";

const CreateOpportunitySchema = z.object({
  shipmentId: z.string(),
  title: z.string().min(5),
  cargoDescription: z.string().min(5),
  cargoWeightKg: z.number().positive(),
  tempRequirementMin: z.number(),
  tempRequirementMax: z.number(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  targetLat: z.number().optional(),
  targetLng: z.number().optional(),
  maxBudget: z.number().positive().optional(),
});

export async function GET() {
  try {
    const actor = await getAuthorizedActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const whereClause = getRescueOpportunitiesWhereClause(actor);
    const isPartner = actor.role === UserRole.PARTNER;
    const offersWhere = isPartner && actor.primaryOrgId
      ? { partnerOrgId: actor.primaryOrgId }
      : {};

    const opportunities = await prisma.rescueOpportunity.findMany({
      where: whereClause,
      select: {
        id: true,
        organizationId: true,
        shipmentId: true,
        title: true,
        cargoDescription: true,
        cargoWeightKg: true,
        tempRequirementMin: true,
        tempRequirementMax: true,
        urgency: true,
        targetLat: true,
        targetLng: true,
        maxBudget: isPartner ? null : true, // Redacted for competing partners
        status: true,
        acceptedOfferId: true,
        createdAt: true,
        updatedAt: true,
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            title: true,
            cargoType: true,
            latestTemperature: true,
            latestRecordedAt: true,
            originName: true,
            destName: true,
          },
        },
        offers: {
          where: offersWhere,
          select: {
            id: true,
            partnerOrgId: true,
            offerAmount: true,
            capacityOfferedKg: true,
            storageType: true,
            estimatedEtaMinutes: true,
            status: true,
            notes: true,
            createdAt: true,
            partnerOrg: {
              select: { id: true, name: true, slug: true },
            },
            submittedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        milestones: {
          select: {
            id: true,
            milestoneType: true,
            notes: true,
            recordedAt: true,
            actor: { select: { id: true, name: true } },
          },
          orderBy: { recordedAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ opportunities });
  } catch (err: unknown) {
    console.error("List rescue opportunities error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const data = CreateOpportunitySchema.parse(body);

    const shipment = await prisma.shipment.findUnique({
      where: { id: data.shipmentId },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    await assertOrgAccess(user.id, user.role, shipment.organizationId, ["OWNER", "DISPATCHER"]);

    const opp = await createRescueOpportunity({
      organizationId: shipment.organizationId,
      shipmentId: data.shipmentId,
      title: data.title,
      cargoDescription: data.cargoDescription,
      cargoWeightKg: data.cargoWeightKg,
      tempRequirementMin: data.tempRequirementMin,
      tempRequirementMax: data.tempRequirementMax,
      urgency: data.urgency,
      targetLat: data.targetLat,
      targetLng: data.targetLng,
      maxBudget: data.maxBudget,
      actorId: user.id,
      actorEmail: user.email,
    });

    return NextResponse.json({ success: true, opportunity: opp }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("Create rescue opportunity error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
