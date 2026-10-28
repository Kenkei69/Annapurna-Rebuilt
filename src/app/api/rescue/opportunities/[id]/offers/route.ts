import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { submitRescueOffer } from "@/lib/rescue";
import { getUserPrimaryOrg } from "@/lib/org";
import { UserRole } from "@prisma/client";

const SubmitOfferSchema = z.object({
  offerAmount: z.number().positive(),
  capacityOfferedKg: z.number().positive(),
  storageType: z.string().min(2),
  estimatedEtaMinutes: z.number().int().positive(),
  notes: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role !== UserRole.PARTNER && user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Only rescue partners can submit offers" }, { status: 403 });
    }

    const primaryOrg = await getUserPrimaryOrg(user.id);
    if (!primaryOrg) {
      return NextResponse.json({ error: "No organization associated with partner account" }, { status: 400 });
    }

    const { id: opportunityId } = await params;
    const body = await req.json();
    const data = SubmitOfferSchema.parse(body);

    const offer = await submitRescueOffer({
      opportunityId,
      partnerOrgId: primaryOrg.id,
      submittedById: user.id,
      offerAmount: data.offerAmount,
      capacityOfferedKg: data.capacityOfferedKg,
      storageType: data.storageType,
      estimatedEtaMinutes: data.estimatedEtaMinutes,
      notes: data.notes,
    });

    return NextResponse.json({ success: true, offer }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Submit offer error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
