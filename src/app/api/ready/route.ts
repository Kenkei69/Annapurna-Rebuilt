import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/ready
 * Dependency-aware readiness check.
 * Verifies database connectivity before reporting ready.
 * Returns 503 if database is unavailable.
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};

  // Database connectivity check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      error: "Database unreachable",
    };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    {
      status: allOk ? "ready" : "degraded",
      service: "annapurna-rebuilt",
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
