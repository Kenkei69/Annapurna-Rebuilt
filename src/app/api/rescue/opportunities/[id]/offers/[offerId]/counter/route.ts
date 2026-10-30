import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { submitCounterOffer } from "@/lib/rescue";
import { AppError } from "@/lib/errors";

const CounterSchema = z.object({
  counterAmount: z.number().positive(),
  counterNotes: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id, offerId } = await params;
    const body = await req.json();
    const data = CounterSchema.parse(body);

    const offer = await submitCounterOffer({
      opportunityId: id,
      offerId,
      counterAmount: data.counterAmount,
      counterNotes: data.counterNotes,
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
    console.error("Submit counter-offer error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
