import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { runSimulationScenario } from "@/lib/simulator";
import { prisma } from "@/lib/db";
import { assertOrgAccess } from "@/lib/org";
import { UserRole } from "@prisma/client";

const SimSchema = z.object({
  deviceId: z.string(),
  scenario: z.enum([
    "NORMAL",
    "GRADUAL_WARMING",
    "DOOR_AJAR",
    "SENSOR_OFFLINE",
    "REPLAY_DUPLICATE",
  ]),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { deviceId, scenario } = SimSchema.parse(body);

    const device = await prisma.device.findUnique({
      where: { deviceIdentifier: deviceId },
    });
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    if (user.role !== UserRole.ADMIN) {
      await assertOrgAccess(user.id, user.role, device.organizationId);
    }

    const result = await runSimulationScenario(deviceId, scenario);

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Simulator execution error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
