import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaClientInstance?: PrismaClient;
};

export function getDatabaseUrl(): string {
  const url = process.env.ANNAPURNA_DATABASE_URL || process.env.DATABASE_URL;
  if (!url || url.trim().length === 0) {
    throw new Error(
      "FATAL_DB_CONFIG: DATABASE_URL environment variable is required and must not be empty."
    );
  }
  return url.trim();
}

function getOrCreatePrismaClient(): PrismaClient {
  if (!globalForPrisma.prismaClientInstance) {
    const dbUrl = getDatabaseUrl();
    const client = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });

    globalForPrisma.prismaClientInstance = client;
  }
  return globalForPrisma.prismaClientInstance;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getOrCreatePrismaClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
