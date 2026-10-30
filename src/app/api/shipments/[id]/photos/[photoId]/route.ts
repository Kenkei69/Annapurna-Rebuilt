import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError } from "@/lib/errors";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id, photoId } = await params;

    const photo = await prisma.cargoPhoto.findUnique({
      where: { id: photoId },
      include: {
        shipment: {
          select: {
            id: true,
            organizationId: true,
            assignedDriverId: true,
            rescueOpportunity: {
              select: {
                acceptedOfferId: true,
                offers: {
                  where: { status: "ACCEPTED" },
                  select: { partnerOrgId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!photo || photo.shipmentId !== id) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Access authorization check:
    const isAdmin = user.role === "ADMIN";
    const isDriver = photo.shipment.assignedDriverId === user.id;

    // Check fleet membership
    const fleetMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: photo.shipment.organizationId,
        },
      },
    });

    // Check winning partner membership
    const winningOffer = photo.shipment.rescueOpportunity?.offers?.[0];
    let isWinningPartner = false;
    if (winningOffer) {
      const partnerMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: winningOffer.partnerOrgId,
          },
        },
      });
      isWinningPartner = Boolean(partnerMembership);
    }

    if (!isAdmin && !isDriver && !fleetMembership && !isWinningPartner) {
      throw new ForbiddenError(
        "FORBIDDEN: You do not have permission to access this private cargo photo."
      );
    }

    // Prevent path traversal and restrict strictly within uploads directory
    const safeRelPath = path.normalize(photo.storagePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const uploadsDir = path.join(process.cwd(), "uploads");
    const absolutePath = path.resolve(uploadsDir, path.relative("uploads", safeRelPath));
    if (!absolutePath.startsWith(uploadsDir)) {
      throw new ForbiddenError("FORBIDDEN: Invalid file path.");
    }
    try {
      const fileBuffer = await fs.readFile(absolutePath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": photo.mimeType,
          "Content-Length": fileBuffer.length.toString(),
          "Cache-Control": "private, no-store, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Image file not found on storage" },
        { status: 404 }
      );
    }
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("Serve cargo photo error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
