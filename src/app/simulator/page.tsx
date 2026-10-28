import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { SimulatorClient } from "@/components/simulator/SimulatorClient";

export default async function SimulatorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = user.memberships[0]?.organizationId;

  const devices = await prisma.device.findMany({
    where: user.role === "ADMIN" ? {} : { organizationId: orgId },
    include: {
      shipments: {
        where: {
          status: { in: ["DISPATCHED", "IN_TRANSIT", "ALERTED", "RESCUE_PENDING"] },
        },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Synthetic Telemetry Lab</h1>
          <p className="text-xs text-slate-500 mt-1">
            Emit controlled telemetry events, thermal breach patterns, delayed messages &amp; duplicate replays
          </p>
        </div>

        <SimulatorClient devices={devices} />
      </div>
    </AppShell>
  );
}
