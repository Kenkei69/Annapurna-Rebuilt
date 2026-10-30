import { z } from "zod";

export const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters in production"),
  ENABLE_SIMULATOR: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1"),
  CRON_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  sessionSecret: string;
  isSimulatorEnabled: boolean;
  hasCronSecret: boolean;
  hasGeminiKey: boolean;
}

/**
 * Validates runtime environment configuration against operational prerequisites.
 * Fails fast with actionable error messages if required secrets or parameters are missing.
 */
export function validateStartupConfig(): { valid: boolean; errors: string[]; config?: AppConfig } {
  const errors: string[] = [];

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.trim() === "") {
    errors.push("Missing DATABASE_URL environment variable.");
  }

  const sessionSecret = process.env.SESSION_SECRET || "fallback-secret-for-local-development-only-min-32-chars";
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET) {
      errors.push("Production requires explicit SESSION_SECRET configuration.");
    } else if (process.env.SESSION_SECRET.length < 16) {
      errors.push("SESSION_SECRET must be at least 16 characters in production.");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    config: {
      nodeEnv: (process.env.NODE_ENV as "development" | "test" | "production") || "development",
      databaseUrl: dbUrl!,
      sessionSecret,
      isSimulatorEnabled: process.env.ENABLE_SIMULATOR === "true",
      hasCronSecret: !!process.env.CRON_SECRET,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
    },
  };
}
