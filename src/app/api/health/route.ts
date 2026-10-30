import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Lightweight liveness check — confirms the process is running and can respond.
 * Does NOT verify database connectivity (use /api/ready for that).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "annapurna-rebuilt",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
