import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createRescueOpportunity } from "@/lib/rescue";
import { getUserPrimaryOrg, assertOrgAccess } from "@/lib/org";
import { UserRole, RescueStatus } from "@prisma/client";
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
    const user = await requireAuth();
    const primaryOrg = await getUserPrimaryOrg(user.id);

    if (user.role === UserRole.PARTNER && primaryOrg) {
      // Rescue Partners see:
      // 1. All OPEN or OFFERED rescue requests (publicly broadcast for bids)
      // 2. Any rescue opportunity where THEIR organization has submitted an offer
      const opportunities = await prisma.rescueOpportunity.findMany({
        where: {
          OR: [
            { status: { in: [RescueStatus.OPEN, RescueStatus.OFFERED] } },
            { offers: { some: { partnerOrgId: primaryOrg.id } } },
          ],
        },
        include: {
          shipment: {
            select: {
              trackingNumber: true,
              originName: true,
              destName: true,
              latestTemperature: true,
              latestRecordedAt: true,
            },
          },
          // Only include offers submitted by THIS partner org (no leaking competitor offers!)
          offers: {
            where: { partnerOrgId: primaryOrg.id },
            include: { submittedBy: { select: { id: true, name: true } } },
          },
          milestones: {
            orderBy: { recordedAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ opportunities });
    }

    // Fleet Operators and Admins
    const whereClause: Record<string, unknown> = {};
    if (user.role !== UserRole.ADMIN && primaryOrg) {
      whereClause.organizationId = primaryOrg.id;
    }

    const opportunities = await prisma.rescueOpportunity.findMany({
      where: whereClause,
      include: {
        shipment: {
          select: {
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
          include: {
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
          include: { actor: { select: { id: true, name: true } } },
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
