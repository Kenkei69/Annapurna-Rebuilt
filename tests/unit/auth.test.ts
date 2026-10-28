import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  getSessionSecret,
} from "../../src/lib/auth";
import { UserRole } from "@prisma/client";

test("Auth Module - Password hashing and verification", async () => {
  const plain = "StrongSecretPassw0rd!";
  const hash = await hashPassword(plain);

  assert.notEqual(hash, plain);
  const isValid = await verifyPassword(plain, hash);
  assert.equal(isValid, true);

  const isInvalid = await verifyPassword("WrongPassword", hash);
  assert.equal(isInvalid, false);
});

test("Auth Module - Session Token creation and valid verification", () => {
  const payload = {
    userId: "user-12345",
    email: "operator@transcold.com",
    role: UserRole.OPERATOR,
  };

  const token = createSessionToken(payload, 2); // 2 hours
  assert.ok(token.includes("."));

  const verified = verifySessionToken(token);
  assert.ok(verified);
  assert.equal(verified.userId, payload.userId);
  assert.equal(verified.email, payload.email);
  assert.equal(verified.role, payload.role);
  assert.ok(verified.exp > Math.floor(Date.now() / 1000));
});

test("Auth Module - Production secret configuration enforcement", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.SESSION_SECRET;

  try {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "";

    // In production, missing or short secret must throw fatal error
    assert.throws(
      () => getSessionSecret(),
      /FATAL_AUTH_CONFIG: SESSION_SECRET must be explicitly configured with at least 32 characters in production/
    );

    process.env.SESSION_SECRET = "too-short-secret";
    assert.throws(
      () => getSessionSecret(),
      /FATAL_AUTH_CONFIG: SESSION_SECRET must be explicitly configured with at least 32 characters in production/
    );

    process.env.SESSION_SECRET = "a_sufficiently_strong_production_secret_32_chars_ok!";
    assert.doesNotThrow(() => getSessionSecret());
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.SESSION_SECRET = originalSecret;
  }
});

test("Auth Module - Tampered token signature is rejected safely", () => {
  const payload = {
    userId: "user-attacker",
    email: "hacker@evil.com",
    role: UserRole.ADMIN,
  };

  const token = createSessionToken(payload, 1);
  const [data] = token.split(".");
  const tamperedToken = `${data}.invalid_signature_here`;

  const verified = verifySessionToken(tamperedToken);
  assert.equal(verified, null);
});

test("Auth Module - Tampered payload with original signature is rejected", () => {
  const payload = {
    userId: "user-regular",
    email: "user@example.com",
    role: UserRole.DRIVER,
  };

  const token = createSessionToken(payload, 1);
  const [, signature] = token.split(".");

  // Tamper payload to escalate role to ADMIN
  const forgedPayload = {
    userId: "user-regular",
    email: "user@example.com",
    role: UserRole.ADMIN,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const forgedData = Buffer.from(JSON.stringify(forgedPayload)).toString("base64url");
  const forgedToken = `${forgedData}.${signature}`;

  const verified = verifySessionToken(forgedToken);
  assert.equal(verified, null);
});

test("Auth Module - Expired token and exact expiry boundary are rejected", () => {
  const payload = {
    userId: "user-old",
    email: "old@example.com",
    role: UserRole.DRIVER,
  };

  // Past token
  const expiredToken = createSessionToken(payload, -1);
  assert.equal(verifySessionToken(expiredToken), null);

  // Exact boundary token: exp === nowSec
  const nowSec = Math.floor(Date.now() / 1000);
  const exactPayload = { ...payload, exp: nowSec };
  const data = Buffer.from(JSON.stringify(exactPayload)).toString("base64url");
  const secret = getSessionSecret();
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  const exactToken = `${data}.${signature}`;

  assert.equal(verifySessionToken(exactToken), null, "Token on exact expiry boundary must be rejected");
});

test("Auth Module - Non-numeric, null, missing, or invalid expiry is rejected", () => {
  const secret = getSessionSecret();

  const invalidExpiries = [
    "not-a-number",
    null,
    undefined,
    NaN,
    -100,
    0,
    {},
    [],
  ];

  for (const exp of invalidExpiries) {
    const rawObj = {
      userId: "user-test",
      email: "test@example.com",
      role: UserRole.OPERATOR,
      exp,
    };
    const data = Buffer.from(JSON.stringify(rawObj)).toString("base64url");
    const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    const token = `${data}.${signature}`;

    assert.equal(
      verifySessionToken(token),
      null,
      `Expiry ${JSON.stringify(exp)} must be rejected`
    );
  }
});

test("Auth Module - Malformed user identifier or unsupported role is rejected", () => {
  const secret = getSessionSecret();

  const invalidPayloads = [
    { userId: "", email: "test@example.com", role: UserRole.OPERATOR, exp: Math.floor(Date.now() / 1000) + 3600 },
    { userId: 12345, email: "test@example.com", role: UserRole.OPERATOR, exp: Math.floor(Date.now() / 1000) + 3600 },
    { userId: "user-ok", email: "not-an-email", role: UserRole.OPERATOR, exp: Math.floor(Date.now() / 1000) + 3600 },
    { userId: "user-ok", email: "test@example.com", role: "SUPER_GOD_ROLE", exp: Math.floor(Date.now() / 1000) + 3600 },
  ];

  for (const p of invalidPayloads) {
    const data = Buffer.from(JSON.stringify(p)).toString("base64url");
    const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    const token = `${data}.${signature}`;

    assert.equal(verifySessionToken(token), null, `Payload ${JSON.stringify(p)} must be rejected`);
  }
});

test("Auth Module - Oversized tokens and malformed encodings are rejected safely", () => {
  assert.equal(verifySessionToken(""), null);
  assert.equal(verifySessionToken("single-part-no-dot"), null);
  assert.equal(verifySessionToken("one.two.three"), null);
  assert.equal(verifySessionToken("not-base64.signature"), null);

  // Oversized token (> 4096 bytes)
  const hugeString = "a".repeat(5000);
  assert.equal(verifySessionToken(`${hugeString}.${hugeString}`), null);
});
