import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { runSimulationScenario, isSimulatorEnabled } from "@/lib/simulator";
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
    if (!isSimulatorEnabled()) {
      return NextResponse.json(
        { error: "SIMULATOR_DISABLED: Simulation scenarios are disabled in this environment." },
        { status: 403 }
      );
    }

    const user = await requireAuth();

    if (user.role !== UserRole.OPERATOR && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "FORBIDDEN: Simulation execution requires OPERATOR or ADMIN role." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { deviceId, scenario } = SimSchema.parse(body);

    const device = await prisma.device.findUnique({
      where: { deviceIdentifier: deviceId },
    });
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Explicit tenant check: Administrators must also be verified members of the organization
    // to execute operational mutations like telemetry simulation
    await assertOrgAccess(user.id, user.role, device.organizationId, {
      mode: "MUTATE_OPERATIONAL",
    });

    const result = await runSimulationScenario(deviceId, scenario);

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    const message = (err as Error).message;
    if (message.includes("FORBIDDEN") || message.includes("ORG_ACCESS_DENIED") || message.includes("SIMULATION_TARGET_REJECTED")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Simulator execution error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
