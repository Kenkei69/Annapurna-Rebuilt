/**
 * Production Administrator Provisioning Script
 * Provisions a platform administrator using securely provided environment configuration.
 * Does NOT wipe any existing data.
 */

import { PrismaClient, UserRole, OrgType, OrgMemberRole } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { getDatabaseUrl } from "../src/lib/db";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

export function validateAdminPassword(password: string): boolean {
  if (!password || password.length < 12) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "System Administrator";

  if (!email || !email.includes("@")) {
    throw new Error(
      "ADMIN_EMAIL environment variable is required and must be a valid email address."
    );
  }

  if (!password || !validateAdminPassword(password)) {
    throw new Error(
      "ADMIN_PASSWORD must be provided and satisfy high entropy requirements (min 12 chars, containing uppercase, lowercase, number, and special character)."
    );
  }

  console.log(`🔐 Provisioning administrator account for: ${email}...`);

  const passwordHash = await hashPassword(password);

  const adminUser = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      name,
    },
    create: {
      email,
      passwordHash,
      name,
      role: UserRole.ADMIN,
    },
  });

  // Ensure system ops organization
  const systemOrg = await prisma.organization.upsert({
    where: { slug: "system-ops" },
    update: {},
    create: {
      name: "Annapurna System Operations",
      slug: "system-ops",
      type: OrgType.ADMINISTRATIVE,
    },
  });

  // Ensure membership
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: systemOrg.id,
      },
    },
    update: {
      orgRole: OrgMemberRole.OWNER,
    },
    create: {
      userId: adminUser.id,
      organizationId: systemOrg.id,
      orgRole: OrgMemberRole.OWNER,
    },
  });

  console.log(`✅ Administrator successfully provisioned: ${email} (${adminUser.id})`);
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("provision-admin.ts") || process.argv[1].endsWith("provision-admin.js"));

if (isDirectRun && process.env.NODE_ENV !== "test") {
  main()
    .catch((e) => {
      console.error("❌ Administrator provisioning failed:", e.message);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
