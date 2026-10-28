import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { acceptRescueOffer } from "@/lib/rescue";
import { assertOrgAccess } from "@/lib/org";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

const AcceptOfferSchema = z.object({
  offerId: z.string(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;
    const body = await req.json();
    const { offerId } = AcceptOfferSchema.parse(body);

    const opp = await prisma.rescueOpportunity.findUnique({
      where: { id: opportunityId },
    });
    if (!opp) {
      return NextResponse.json({ error: "Rescue opportunity not found" }, { status: 404 });
    }

    // Only fleet owner / dispatcher can accept offers
    await assertOrgAccess(user.id, user.role, opp.organizationId, ["OWNER", "DISPATCHER"]);

    const result = await acceptRescueOffer({
      opportunityId,
      offerId,
      actorId: user.id,
      actorEmail: user.email,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("Accept offer error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
