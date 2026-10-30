import { NextResponse } from "next/server";
import { getAuthorizedActor, loadAuthorizedShipmentDetails } from "@/lib/auth/policy";
import { AppError, NotFoundError, ForbiddenError } from "@/lib/errors";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthorizedActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { shipment, accessLevel } = await loadAuthorizedShipmentDetails(actor, id);

    return NextResponse.json({ shipment, accessLevel });
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("Get shipment error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
