import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserPrimaryOrg } from "@/lib/org";
import { UserRole } from "@prisma/client";

export async function GET() {
  try {
    const user = await requireAuth();
    const primaryOrg = await getUserPrimaryOrg(user.id);

    const whereClause: Record<string, unknown> = {};

    if (user.role !== UserRole.ADMIN) {
      if (!primaryOrg) {
        return NextResponse.json({ auditEvents: [] });
      }
      whereClause.organizationId = primaryOrg.id;
    }

    const auditEvents = await prisma.auditEvent.findMany({
      where: whereClause,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ auditEvents });
  } catch (err: unknown) {
    console.error("Audit query error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
