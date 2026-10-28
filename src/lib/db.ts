import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.ANNAPURNA_DATABASE_URL;
  if (!url || url.trim().length === 0) {
    throw new Error(
      "FATAL_DB_CONFIG: DATABASE_URL environment variable is required and must not be empty."
    );
  }
  return url.trim();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
