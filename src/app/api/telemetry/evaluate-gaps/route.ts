import { NextResponse } from "next/server";
import { detectMissingTelemetry } from "@/lib/alerts";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/telemetry/evaluate-gaps
 * Evaluates in-transit shipments for missing telemetry / heartbeat timeouts.
 * Can be invoked by:
 * 1. Background scheduled worker (AWS EventBridge, Cloudflare Worker, Vercel Cron) with `Authorization: Bearer <CRON_SECRET>`
 * 2. Authenticated operator or administrator session.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthed = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuthed) {
      const user = await getCurrentUser(req);
      if (!user || (user.role !== "ADMIN" && user.role !== "OPERATOR")) {
        return NextResponse.json(
          { error: "Unauthorized: Requires CRON_SECRET bearer token or OPERATOR/ADMIN session." },
          { status: 401 }
        );
      }
    }

    const url = new URL(req.url);
    const windowParam = url.searchParams.get("windowMinutes");
    const windowMinutes = windowParam ? Math.max(1, parseInt(windowParam, 10)) : 15;

    const createdAlerts = await detectMissingTelemetry(windowMinutes);

    return NextResponse.json({
      success: true,
      evaluatedAt: new Date().toISOString(),
      heartbeatWindowMinutes: windowMinutes,
      alertsCreated: createdAlerts.length,
      alerts: createdAlerts.map((a) => ({
        id: a.id,
        shipmentId: a.shipmentId,
        ruleCode: a.ruleCode,
        severity: a.severity,
        summary: a.summary,
      })),
    });
  } catch (err: unknown) {
    console.error("Evaluate gaps error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to evaluate telemetry gaps" },
      { status: 500 }
    );
  }
}
