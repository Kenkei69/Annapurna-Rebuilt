import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const trackingNumber = url.searchParams.get("trackingNumber");

    if (!trackingNumber || trackingNumber.trim().length === 0) {
      return NextResponse.json(
        { error: "trackingNumber query parameter is required" },
        { status: 400 }
      );
    }

    const trimmed = trackingNumber.trim();

    // Query shipment by tracking number with strictly sanitized projection (case-insensitive)
    const shipment = await prisma.shipment.findFirst({
      where: {
        trackingNumber: {
          equals: trimmed,
          mode: "insensitive",
        },
      },
      select: {
        trackingNumber: true,
        title: true,
        cargoType: true,
        status: true,
        tempMin: true,
        tempMax: true,
        originName: true,
        destName: true,
        latestTemperature: true,
        latestRecordedAt: true,
        createdAt: true,
        updatedAt: true,
        // Projections omit all internal org IDs, device tokens, and driver credentials
        assignedVehicle: {
          select: {
            makeModel: true,
            reeferType: true,
          },
        },
        alerts: {
          where: { status: "ACTIVE" },
          select: {
            ruleCode: true,
            severity: true,
            summary: true,
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: `No active or historical consignment found with tracking number: ${trimmed}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      shipment,
    });
  } catch (err: unknown) {
    console.error("Public track error:", err);
    return NextResponse.json(
      { error: "Internal server error occurred while retrieving tracking status." },
      { status: 500 }
    );
  }
}
