import test from "node:test";
import assert from "node:assert/strict";
import { assertSafeForDestructiveReset } from "../../src/lib/db-safety";
import { validateAdminPassword } from "../../scripts/provision-admin";
import { getDatabaseUrl } from "../../src/lib/db";

test("Database Safety - Refuses destructive reset in production environment", () => {
  assert.throws(
    () => {
      assertSafeForDestructiveReset({
        environment: "production",
        allowDestructiveResetFlag: true,
        databaseUrl: "postgresql://postgres:password@localhost:5432/annapurna_db",
      });
    },
    /FATAL_DESTRUCTIVE_GUARD: Destructive reset operations are strictly forbidden in production/
  );
});

test("Database Safety - Refuses destructive reset without explicit flag", () => {
  assert.throws(
    () => {
      assertSafeForDestructiveReset({
        environment: "development",
        allowDestructiveResetFlag: false,
        databaseUrl: "postgresql://postgres:password@localhost:5432/annapurna_db",
      });
    },
    /FATAL_DESTRUCTIVE_GUARD: Destructive reset requires explicit flag ALLOW_DESTRUCTIVE_RESET=true/
  );
});

test("Database Safety - Refuses destructive reset if database URL is missing", () => {
  assert.throws(
    () => {
      assertSafeForDestructiveReset({
        environment: "development",
        allowDestructiveResetFlag: true,
        databaseUrl: "",
      });
    },
    /FATAL_DESTRUCTIVE_GUARD: No DATABASE_URL provided/
  );
});

test("Database Safety - Refuses reset targeting a database with production indicators", () => {
  const prodUrls = [
    "postgres://user:pass@ep-cool-pooler.us-east-1.aws.neon.tech/neondb",
    "postgres://postgres:pass@db.projectref.supabase.co:5432/postgres",
    "postgresql://app:pass@annapurna-prod.rds.amazonaws.com:5432/prod_db",
  ];

  for (const dbUrl of prodUrls) {
    assert.throws(
      () => {
        assertSafeForDestructiveReset({
          environment: "development",
          allowDestructiveResetFlag: true,
          databaseUrl: dbUrl,
        });
      },
      /FATAL_DESTRUCTIVE_GUARD: Target database URL contains production indicators/
    );
  }
});

test("Database Safety - Credentials with test keywords do not bypass production database protection", () => {
  // Password or username containing "test" or "dev" must not fool the safety check
  assert.throws(
    () => {
      assertSafeForDestructiveReset({
        environment: "development",
        allowDestructiveResetFlag: true,
        databaseUrl: "postgresql://dev_user:secret_test_password@prod.internal:5432/core_business_db",
      });
    },
    /FATAL_DESTRUCTIVE_GUARD: Target database URL contains production indicators on host 'prod.internal'|FATAL_DESTRUCTIVE_GUARD: Target database name 'core_business_db' is not in the explicit disposable database whitelist/
  );
});

test("Database Safety - Allows reset only for explicitly designated local/test database", () => {
  assert.doesNotThrow(() => {
    assertSafeForDestructiveReset({
      environment: "development",
      allowDestructiveResetFlag: "true",
      databaseUrl: "postgresql://postgres:password@localhost:5432/annapurna_local_dev",
    });
  });

  assert.doesNotThrow(() => {
    assertSafeForDestructiveReset({
      environment: "test",
      allowDestructiveResetFlag: true,
      databaseUrl: "postgresql://postgres:password@localhost:5432/annapurna_test_db",
    });
  });
});

test("Database Configuration - getDatabaseUrl fails closed when DATABASE_URL is unset", () => {
  const originalUrl = process.env.DATABASE_URL;
  const originalAnnapurnaUrl = process.env.ANNAPURNA_DATABASE_URL;

  try {
    delete process.env.DATABASE_URL;
    delete process.env.ANNAPURNA_DATABASE_URL;

    assert.throws(
      () => getDatabaseUrl(),
      /FATAL_DB_CONFIG: DATABASE_URL environment variable is required/
    );
  } finally {
    if (originalUrl) process.env.DATABASE_URL = originalUrl;
    if (originalAnnapurnaUrl) process.env.ANNAPURNA_DATABASE_URL = originalAnnapurnaUrl;
  }
});

test("Admin Provisioning - Password policy requires minimum 12 chars with complexity", () => {
  assert.equal(validateAdminPassword("short1!"), false);
  assert.equal(validateAdminPassword("nouppercase123!"), false);
  assert.equal(validateAdminPassword("NOLOWERCASE123!"), false);
  assert.equal(validateAdminPassword("NoSpecialCharacters123"), false);
  assert.equal(validateAdminPassword("NoNumbersAtAll!@#$"), false);

  assert.equal(validateAdminPassword("ValidStrongPassword123!@#"), true);
});
