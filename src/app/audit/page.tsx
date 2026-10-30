import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { AuditClient } from "./AuditClient";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = user.memberships[0]?.organizationId;

  const events = await prisma.auditEvent.findMany({
    where: user.role === "ADMIN" ? {} : { organizationId: orgId },
    select: {
      id: true,
      organizationId: true,
      actorId: true,
      actorEmail: true,
      action: true,
      entityType: true,
      entityId: true,
      detailsJson: true,
      ipAddress: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.memberships[0]?.organization,
      }}
    >
      <AuditClient
        events={events.map((ev) => ({
          ...ev,
          createdAt: ev.createdAt.toISOString(),
        }))}
      />
    </AppShell>
  );
}
