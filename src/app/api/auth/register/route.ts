import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, createSessionToken, authCookieConfig } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { OrgType, UserRole } from "@prisma/client";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2),
  organizationName: z.string().min(2),
  accountType: z.enum(["FLEET_OPERATOR", "RESCUE_PARTNER"]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = RegisterSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(data.password);
    const role =
      data.accountType === "RESCUE_PARTNER" ? UserRole.PARTNER : UserRole.OPERATOR;
    const orgType =
      data.accountType === "RESCUE_PARTNER" ? OrgType.RESCUE_PARTNER : OrgType.FLEET;

    // Create user and organization
    const { user, org } = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: data.email.toLowerCase().trim(),
          passwordHash,
          name: data.name,
          role,
        },
      });

      const slug =
        data.organizationName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") + `-${Date.now().toString(36)}`;

      const o = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug,
          type: orgType,
          memberships: {
            create: {
              userId: u.id,
              orgRole: "OWNER",
            },
          },
        },
      });

      // If rescue partner, initialize unverified profile awaiting onboarding
      if (orgType === OrgType.RESCUE_PARTNER) {
        await tx.rescuePartnerProfile.create({
          data: {
            organizationId: o.id,
            facilityName: `${data.organizationName} Facility`,
            facilityType: "COLD_STORAGE",
            address: null,
            latitude: null,
            longitude: null,
            capacityAvailableKg: null,
            tempRangeMin: null,
            tempRangeMax: null,
            contactEmail: u.email,
            contactPhone: null,
            isActive: false,
            onboardingComplete: false,
            verificationStatus: "UNVERIFIED_SELF_REPORTED",
          },
        });
      }

      await recordAuditEvent(
        {
          organizationId: o.id,
          actorId: u.id,
          actorEmail: u.email,
          action: "ACCOUNT_REGISTERED",
          entityType: "User",
          entityId: u.id,
          details: { role, organizationName: o.name, orgType },
        },
        tx
      );

      return { user: u, org: o };
    });

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: org,
      },
    });

    response.cookies.set(
      authCookieConfig.name,
      token,
      authCookieConfig.options
    );

    return response;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Registration error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
