import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { AppError, ForbiddenError } from "@/lib/errors";
import { validateImageBuffer } from "@/lib/images";

const UploadSchema = z.object({
  dataUrl: z.string().min(20),
  fileName: z.string().min(1).max(255).default("cargo-photo.jpg"),
  caption: z.string().max(500).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      select: { id: true, organizationId: true, assignedDriverId: true },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Authorization: User must be member of shipment org, assigned driver, or admin
    const isAdmin = user.role === "ADMIN";
    const isDriver = shipment.assignedDriverId === user.id;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: shipment.organizationId,
        },
      },
    });

    if (!isAdmin && !isDriver && !membership) {
      throw new ForbiddenError("FORBIDDEN: You do not have access to view this shipment's photos.");
    }

    const photos = await prisma.cargoPhoto.findMany({
      where: { shipmentId: id },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ photos });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("Get cargo photos error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      select: { id: true, organizationId: true, assignedDriverId: true, trackingNumber: true },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Authorization
    const isAdmin = user.role === "ADMIN";
    const isDriver = shipment.assignedDriverId === user.id;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: shipment.organizationId,
        },
      },
    });

    if (!isAdmin && !isDriver && !membership) {
      throw new ForbiddenError("FORBIDDEN: You do not have access to upload photos for this shipment.");
    }

    const body = await req.json();
    const data = UploadSchema.parse(body);

    // Decode base64 dataUrl
    const match = data.dataUrl.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid data URL format. Expected 'data:<mime>;base64,<payload>'" },
        { status: 400 }
      );
    }

    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");

    // Validate MIME, magic bytes, dimensions, and size limit
    const validated = validateImageBuffer(buffer);

    const photoId = crypto.randomUUID();
    const ext = validated.mimeType === "image/png" ? "png" : validated.mimeType === "image/webp" ? "webp" : "jpg";
    const relativeStorageDir = path.join("uploads", "cargo-photos", shipment.id);
    const absoluteStorageDir = path.join(process.cwd(), relativeStorageDir);
    const storagePath = path.join(relativeStorageDir, `${photoId}.${ext}`);
    const absoluteFilePath = path.join(process.cwd(), storagePath);

    await fs.mkdir(absoluteStorageDir, { recursive: true });
    await fs.writeFile(absoluteFilePath, buffer);

    const photo = await prisma.cargoPhoto.create({
      data: {
        id: photoId,
        shipmentId: shipment.id,
        storagePath,
        fileName: data.fileName,
        mimeType: validated.mimeType,
        fileSizeBytes: validated.sizeBytes,
        widthPx: validated.dimensions.width,
        heightPx: validated.dimensions.height,
        uploadedById: user.id,
        caption: data.caption?.trim() || null,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await recordAuditEvent({
      organizationId: shipment.organizationId,
      actorId: user.id,
      actorEmail: user.email,
      action: "CARGO_PHOTO_UPLOADED",
      entityType: "CargoPhoto",
      entityId: photo.id,
      details: {
        shipmentTrackingNumber: shipment.trackingNumber,
        fileSizeBytes: photo.fileSizeBytes,
        dimensions: `${photo.widthPx}x${photo.heightPx}`,
        mimeType: photo.mimeType,
      },
    });

    return NextResponse.json({ success: true, photo }, { status: 201 });
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
    console.error("Upload cargo photo error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
