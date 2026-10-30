import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { resolveAlert } from "@/lib/alerts";
import { prisma } from "@/lib/db";
import { assertOrgAccess } from "@/lib/org";

const ResolveSchema = z.object({
  resolutionNotes: z.string().min(5, "Resolution notes must be at least 5 characters"),
  overrideReason: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const { resolutionNotes, overrideReason } = ResolveSchema.parse(body);

    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    await assertOrgAccess(user.id, user.role, alert.organizationId);

    const updated = await resolveAlert({
      alertId: id,
      actorId: user.id,
      actorEmail: user.email,
      resolutionNotes,
      overrideReason,
    });

    return NextResponse.json({ success: true, alert: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Resolve alert error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
