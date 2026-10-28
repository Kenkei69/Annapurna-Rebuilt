import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedActor, loadAuthorizedShipmentDetails } from "@/lib/auth/policy";
import { AppShell } from "@/components/layout/AppShell";
import { ShipmentDetailClient } from "@/components/shipments/ShipmentDetailClient";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const actor = await getAuthorizedActor();
  if (!actor) redirect("/login");

  const { id } = await params;

  let shipmentDetails: Awaited<ReturnType<typeof loadAuthorizedShipmentDetails>>;
  try {
    shipmentDetails = await loadAuthorizedShipmentDetails(actor, id);
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    if (err instanceof ForbiddenError) {
      redirect("/dashboard");
    }
    throw err;
  }

  const { shipment, accessLevel } = shipmentDetails;

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
      <ShipmentDetailClient
        shipment={shipment}
        userRole={user.role}
        accessLevel={accessLevel}
      />
    </AppShell>
  );
}
