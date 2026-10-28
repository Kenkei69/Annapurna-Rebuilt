import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
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

test("Auth Module - Tampered token signature is rejected", () => {
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

test("Auth Module - Expired token is rejected", () => {
  const payload = {
    userId: "user-old",
    email: "old@example.com",
    role: UserRole.DRIVER,
  };

  // Create token with negative expiry
  const token = createSessionToken(payload, -1);
  const verified = verifySessionToken(token);
  assert.equal(verified, null);
});
