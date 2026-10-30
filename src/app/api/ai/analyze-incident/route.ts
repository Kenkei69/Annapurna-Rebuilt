import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analyzeIncidentWithAI } from "@/lib/ai";
import { assertOrgAccess } from "@/lib/org";

const AnalyzeSchema = z.object({
  shipmentId: z.string(),
  advisoryQuestion: z.string().max(500).optional(),
  language: z.enum(["en", "hi", "mr", "ta", "te", "bn", "gu"]).default("en"),
  cargoPhotoId: z.string().optional(),
});

const HOURLY_REQUEST_BUDGET = 20;

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const data = AnalyzeSchema.parse(body);

    const shipment = await prisma.shipment.findUnique({
      where: { id: data.shipmentId },
      include: {
        alerts: {
          where: { status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
        },
        telemetryReadings: {
          orderBy: { recordedAt: "desc" },
          take: 8,
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    await assertOrgAccess(user.id, user.role, shipment.organizationId);

    // Request budget check: Maximum 20 requests per shipment per hour
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const recentQueriesCount = await prisma.incidentAssessment.count({
      where: {
        shipmentId: shipment.id,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentQueriesCount >= HOURLY_REQUEST_BUDGET) {
      return NextResponse.json(
        {
          error: `Request budget exceeded. Maximum ${HOURLY_REQUEST_BUDGET} AI advisory evaluations per shipment per hour.`,
          retryAfterSeconds: 60,
          budgetLimit: HOURLY_REQUEST_BUDGET,
          budgetRemaining: 0,
        },
        { status: 429 }
      );
    }

    const analysis = await analyzeIncidentWithAI({
      shipmentTitle: shipment.title,
      cargoType: shipment.cargoType,
      tempMin: shipment.tempMin,
      tempMax: shipment.tempMax,
      currentTemp: shipment.latestTemperature ?? (shipment.tempMin + shipment.tempMax) / 2,
      readings: shipment.telemetryReadings.map((r) => ({
        temperature: r.temperature,
        recordedAt: r.recordedAt,
      })),
      activeAlerts: shipment.alerts.map((a) => ({
        ruleCode: a.ruleCode,
        summary: a.summary,
        severity: a.severity,
      })),
      advisoryQuestion: data.advisoryQuestion,
      language: data.language,
    });

    // Persist assessment history in PostgreSQL
    const savedAssessment = await prisma.incidentAssessment.create({
      data: {
        shipmentId: shipment.id,
        cargoPhotoId: data.cargoPhotoId || null,
        riskLevel: analysis.riskLevel,
        summary: analysis.summary,
        advisoryQuestion: data.advisoryQuestion || null,
        language: data.language,
        source: analysis.source,
        suggestedActions: JSON.stringify(analysis.suggestedActions),
        draftDriverUpdate: analysis.draftDriverUpdate,
        uncertaintyNotes: analysis.uncertaintyNotes,
        warmingVelocity: analysis.warmingVelocityPer10Min,
        estimatedMinutes: analysis.estimatedMinutesToSpoilage,
      },
    });

    const budgetRemaining = Math.max(0, HOURLY_REQUEST_BUDGET - (recentQueriesCount + 1));

    return NextResponse.json({
      success: true,
      analysis,
      assessmentId: savedAssessment.id,
      budgetRemaining,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("AI analysis error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
