import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analyzeIncidentWithAI } from "@/lib/ai";
import { assertOrgAccess } from "@/lib/org";

const AnalyzeSchema = z.object({
  shipmentId: z.string(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { shipmentId } = AnalyzeSchema.parse(body);

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
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
    });

    return NextResponse.json({ success: true, analysis });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("AI analysis error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
