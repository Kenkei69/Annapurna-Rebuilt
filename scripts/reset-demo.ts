/**
 * Destructive Demo Reset Script (Isolated Development & Testing Environments ONLY)
 * Strictly protected against execution in production or undesignated databases.
 */

import { PrismaClient } from "@prisma/client";
import { assertSafeForDestructiveReset } from "../src/lib/db-safety";
import { getDatabaseUrl } from "../src/lib/db";

async function main() {
  const dbUrl = getDatabaseUrl();

  // Enforce multi-layered safety guard
  assertSafeForDestructiveReset({
    databaseUrl: dbUrl,
    environment: process.env.NODE_ENV,
    allowDestructiveResetFlag: process.env.ALLOW_DESTRUCTIVE_RESET,
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  console.log("⚠️ Executing authorized development demo database reset...");

  try {
    await prisma.auditEvent.deleteMany();
    await prisma.rescueMilestone.deleteMany();
    await prisma.rescueOffer.deleteMany();
    await prisma.rescueOpportunity.deleteMany();
    await prisma.rescuePartnerProfile.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.telemetryReading.deleteMany();
    await prisma.shipment.deleteMany();
    await prisma.device.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();

    console.log("✅ Development demo reset completed.");
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("reset-demo.ts") || process.argv[1].endsWith("reset-demo.js"));

if (isDirectRun && process.env.NODE_ENV !== "test") {
  main().catch((e) => {
    console.error("❌ Reset aborted:", e.message);
    process.exit(1);
  });
}
