import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { acknowledgeAlert } from "@/lib/alerts";
import { prisma } from "@/lib/db";
import { assertOrgAccess } from "@/lib/org";

const AckSchema = z.object({
  notes: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { notes } = AckSchema.parse(body);

    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    await assertOrgAccess(user.id, user.role, alert.organizationId);

    const updated = await acknowledgeAlert({
      alertId: id,
      actorId: user.id,
      actorEmail: user.email,
      notes,
    });

    return NextResponse.json({ success: true, alert: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Acknowledge alert error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
