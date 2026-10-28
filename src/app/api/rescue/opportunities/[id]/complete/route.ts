import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { completeRescue } from "@/lib/rescue";
import { prisma } from "@/lib/db";
import { assertOrgAccess } from "@/lib/org";
import { AppError } from "@/lib/errors";

const CompleteSchema = z.object({
  outcomeNotes: z.string().min(5),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;
    const body = await req.json();
    const { outcomeNotes } = CompleteSchema.parse(body);

    const opp = await prisma.rescueOpportunity.findUnique({
      where: { id: opportunityId },
    });
    if (!opp) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    await assertOrgAccess(user.id, user.role, opp.organizationId, ["OWNER", "DISPATCHER"]);

    const completed = await completeRescue({
      opportunityId,
      actorId: user.id,
      actorEmail: user.email,
      outcomeNotes,
    });

    return NextResponse.json({ success: true, opportunity: completed });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("Complete rescue error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
