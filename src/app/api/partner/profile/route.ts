import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/org";
import { recordAuditEvent } from "@/lib/audit";
import { FacilityType, UserRole } from "@prisma/client";

const UpdatePartnerProfileSchema = z
  .object({
    facilityName: z.string().trim().min(3, "Facility name must be at least 3 characters"),
    facilityType: z.nativeEnum(FacilityType),
    address: z.string().trim().min(5, "Address must be at least 5 characters"),
    latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
    longitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
    capacityAvailableKg: z
      .number()
      .positive("Available capacity must be strictly greater than 0 kg"),
    tempRangeMin: z
      .number()
      .min(-60, "Temperature cannot be below -60°C")
      .max(40, "Minimum temperature cannot exceed 40°C"),
    tempRangeMax: z
      .number()
      .min(-60, "Maximum temperature cannot be below -60°C")
      .max(50, "Maximum temperature cannot exceed 50°C"),
    contactPhone: z.string().trim().min(5, "Contact phone must be at least 5 digits"),
    contactEmail: z.string().trim().email("Valid contact email is required"),
  })
  .refine((data) => data.tempRangeMin < data.tempRangeMax, {
    message: "tempRangeMin must be strictly less than tempRangeMax",
    path: ["tempRangeMin"],
  });

export async function GET() {
  try {
    const user = await requireAuth();
    const primaryOrg = await getUserPrimaryOrg(user.id);

    if (!primaryOrg) {
      return NextResponse.json(
        { error: "No organization associated with user account" },
        { status: 404 }
      );
    }

    const profile = await prisma.rescuePartnerProfile.findUnique({
      where: { organizationId: primaryOrg.id },
    });

    return NextResponse.json({
      organization: primaryOrg,
      profile: profile || null,
      onboardingComplete: profile?.onboardingComplete ?? false,
    });
  } catch (err: unknown) {
    console.error("GET /api/partner/profile error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAuth();

    if (user.role !== UserRole.PARTNER && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Only rescue partners or administrators can update facility onboarding profiles" },
        { status: 403 }
      );
    }

    const primaryOrg = await getUserPrimaryOrg(user.id);
    if (!primaryOrg) {
      return NextResponse.json(
        { error: "No rescue partner organization associated with account" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const data = UpdatePartnerProfileSchema.parse(body);

    const updatedProfile = await prisma.$transaction(async (tx) => {
      const profile = await tx.rescuePartnerProfile.upsert({
        where: { organizationId: primaryOrg.id },
        update: {
          facilityName: data.facilityName,
          facilityType: data.facilityType,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          capacityAvailableKg: data.capacityAvailableKg,
          tempRangeMin: data.tempRangeMin,
          tempRangeMax: data.tempRangeMax,
          contactPhone: data.contactPhone,
          contactEmail: data.contactEmail,
          isActive: true,
          onboardingComplete: true,
          verificationStatus: "SELF_REPORTED_VERIFIED_LOCATION",
        },
        create: {
          organizationId: primaryOrg.id,
          facilityName: data.facilityName,
          facilityType: data.facilityType,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          capacityAvailableKg: data.capacityAvailableKg,
          tempRangeMin: data.tempRangeMin,
          tempRangeMax: data.tempRangeMax,
          contactPhone: data.contactPhone,
          contactEmail: data.contactEmail,
          isActive: true,
          onboardingComplete: true,
          verificationStatus: "SELF_REPORTED_VERIFIED_LOCATION",
        },
      });

      await recordAuditEvent(
        {
          organizationId: primaryOrg.id,
          actorId: user.id,
          actorEmail: user.email,
          action: "PARTNER_ONBOARDING_COMPLETED",
          entityType: "RescuePartnerProfile",
          entityId: profile.id,
          details: {
            facilityName: data.facilityName,
            capacityAvailableKg: data.capacityAvailableKg,
            tempRange: `${data.tempRangeMin}°C to ${data.tempRangeMax}°C`,
          },
        },
        tx
      );

      return profile;
    });

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.errors },
        { status: 400 }
      );
    }
    console.error("PUT /api/partner/profile error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
