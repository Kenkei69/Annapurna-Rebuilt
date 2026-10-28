import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateDevice,
  ingestTelemetryReading,
  TelemetryPayloadSchema,
} from "@/lib/telemetry";

export async function POST(req: Request) {
  try {
    const deviceIdHeader = req.headers.get("x-device-id");
    const deviceKeyHeader =
      req.headers.get("x-device-key") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!deviceIdHeader || !deviceKeyHeader) {
      return NextResponse.json(
        { error: "Missing required authentication headers: X-Device-Id and X-Device-Key" },
        { status: 401 }
      );
    }

    const device = await authenticateDevice(deviceIdHeader, deviceKeyHeader);
    if (!device) {
      return NextResponse.json(
        { error: "Invalid device credentials or suspended device" },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Ensure payload deviceId matches authenticated header
    const parsed = TelemetryPayloadSchema.parse({
      ...body,
      deviceId: device.deviceIdentifier,
    });

    const result = await ingestTelemetryReading(parsed);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid telemetry payload", details: err.errors },
        { status: 400 }
      );
    }
    const message = (err as Error).message;
    if (
      message.includes("FUTURE_TIMESTAMP_REJECTED") ||
      message.includes("SIMULATION_NOT_PERMITTED") ||
      message.includes("AMBIGUOUS_DEVICE_ASSIGNMENT")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Telemetry ingestion error:", err);
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
