import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { respondToCounterOffer } from "@/lib/rescue";
import { AppError } from "@/lib/errors";

const ResponseSchema = z.object({
  accept: z.boolean(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id, offerId } = await params;
    const body = await req.json();
    const data = ResponseSchema.parse(body);

    const offer = await respondToCounterOffer({
      opportunityId: id,
      offerId,
      accept: data.accept,
      actorId: user.id,
      actorEmail: user.email,
    });

    return NextResponse.json({ success: true, offer });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.errors },
        { status: 400 }
      );
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("Counter-offer response error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
