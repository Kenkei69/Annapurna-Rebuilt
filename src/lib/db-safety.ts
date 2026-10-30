/**
 * Database Safety & Environment Guards
 * Enforces production protection rules to prevent data loss or unauthorized resets.
 */

const DISPOSABLE_DATABASE_NAMES = new Set([
  "annapurna_dev",
  "annapurna_test",
  "annapurna_db",
  "annapurna_local_dev",
  "annapurna_test_db",
  "disposable_test",
  "test_db",
]);

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

  // 4. Structural URL parsing: inspect database name, host, and port independently
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(dbUrl);
  } catch (err: unknown) {
    throw new Error(
      `FATAL_DESTRUCTIVE_GUARD: Invalid DATABASE_URL structure: ${(err as Error).message}`
    );
  }

  // Extract database name from pathname (e.g. "/annapurna_test" -> "annapurna_test")
  // Never inspect credentials, usernames, or query parameters as evidence of safety
  const databaseName = parsedUrl.pathname.replace(/^\/+/, "").split("?")[0].toLowerCase();
  const hostname = parsedUrl.hostname.toLowerCase();

  // Hostname production checks (cloud providers / managed DBs)
  const productionHostSuffixes = [
    "rds.amazonaws.com",
    "supabase.co",
    "neon.tech",
    "cockroachlabs.cloud",
    "aivencloud.com",
  ];

  const isProductionHost =
    productionHostSuffixes.some((suffix) => hostname.endsWith(suffix) || hostname.includes(suffix)) ||
    hostname.startsWith("prod.") ||
    hostname.includes("-prod") ||
    hostname.includes("_prod") ||
    hostname === "production";

  if (isProductionHost) {
    throw new Error(
      `FATAL_DESTRUCTIVE_GUARD: Target database URL contains production indicators on host '${hostname}'. Refusing destructive reset.`
    );
  }

  // Strict database name whitelist
  const isDisposable =
    DISPOSABLE_DATABASE_NAMES.has(databaseName) ||
    databaseName.endsWith("_test") ||
    databaseName.endsWith("_dev") ||
    databaseName.startsWith("test_");

  if (!isDisposable) {
    throw new Error(
      `FATAL_DESTRUCTIVE_GUARD: Target database name '${databaseName}' is not in the explicit disposable database whitelist. Refusing destructive reset.`
    );
  }
}
