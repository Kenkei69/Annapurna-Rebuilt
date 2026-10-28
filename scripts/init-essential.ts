/**
 * Essential Initialization Script (Idempotent & Safe)
 * Initializes essential administrative organization if not present.
 * Does NOT erase existing records, users, shipments, or audit trails.
 */

import { PrismaClient, OrgType } from "@prisma/client";
import { getDatabaseUrl } from "../src/lib/db";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

async function main() {
  console.log("🛡️ Running idempotent essential system initialization...");

  // Ensure system operations organization exists
  const systemOrg = await prisma.organization.upsert({
    where: { slug: "system-ops" },
    update: {},
    create: {
      name: "Annapurna System Operations",
      slug: "system-ops",
      type: OrgType.ADMINISTRATIVE,
    },
  });

  console.log(`✅ System operations organization verified: ${systemOrg.name} (${systemOrg.id})`);
  console.log("ℹ️ Essential initialization completed safely without deleting existing records.");
}

main()
  .catch((e) => {
    console.error("❌ Essential initialization failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
