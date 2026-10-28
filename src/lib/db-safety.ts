/**
 * Database Safety & Environment Guards
 * Enforces production protection rules to prevent data loss or unauthorized resets.
 */

export function assertSafeForDestructiveReset(params: {
  databaseUrl?: string;
  environment?: string;
  allowDestructiveResetFlag?: string | boolean;
}): void {
  const env = (params.environment || process.env.NODE_ENV || "development").toLowerCase();
  const dbUrl =
    params.databaseUrl !== undefined ? params.databaseUrl : process.env.DATABASE_URL;
  const flag =
    params.allowDestructiveResetFlag !== undefined
      ? params.allowDestructiveResetFlag
      : process.env.ALLOW_DESTRUCTIVE_RESET;

  // 1. Absolute production safeguard
  if (env === "production") {
    throw new Error(
      "FATAL_DESTRUCTIVE_GUARD: Destructive reset operations are strictly forbidden in production under all circumstances."
    );
  }

  // 2. Explicit deliberate opt-in flag required
  const isFlagAllowed = flag === true || flag === "true" || flag === "1";
  if (!isFlagAllowed) {
    throw new Error(
      "FATAL_DESTRUCTIVE_GUARD: Destructive reset requires explicit flag ALLOW_DESTRUCTIVE_RESET=true."
    );
  }

  // 3. Database URL validation
  if (!dbUrl || dbUrl.trim().length === 0) {
    throw new Error(
      "FATAL_DESTRUCTIVE_GUARD: No DATABASE_URL provided. Cannot verify target database safety."
    );
  }

  // 4. Production database host / name indicator protection
  const lowerUrl = dbUrl.toLowerCase();
  const productionIndicators = [
    "prod.",
    "-prod",
    "_prod",
    "production",
    "rds.amazonaws.com",
    "supabase.co",
    "neon.tech",
  ];

  const hasProdIndicator = productionIndicators.some((ind) => lowerUrl.includes(ind));
  const isExplicitTestDb = lowerUrl.includes("_test") || lowerUrl.includes("test_");

  if (hasProdIndicator && !isExplicitTestDb) {
    throw new Error(
      "FATAL_DESTRUCTIVE_GUARD: Target database URL contains production indicators and is not an isolated test database. Refusing destructive reset."
    );
  }
}
