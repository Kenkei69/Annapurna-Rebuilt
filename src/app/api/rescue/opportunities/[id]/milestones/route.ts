import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { recordRescueMilestone } from "@/lib/rescue";
import { prisma } from "@/lib/db";

const MilestoneSchema = z.object({
  milestoneType: z.string().min(2),
  notes: z.string().min(2),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;
    const body = await req.json();
    const { milestoneType, notes } = MilestoneSchema.parse(body);

    const opp = await prisma.rescueOpportunity.findUnique({
      where: { id: opportunityId },
    });
    if (!opp) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const milestone = await recordRescueMilestone({
      opportunityId,
      actorId: user.id,
      milestoneType,
      notes,
    });

    return NextResponse.json({ success: true, milestone });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Record milestone error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
