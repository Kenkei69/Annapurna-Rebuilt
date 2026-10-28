# Annapurna Rebuilt — Security Architecture & Threat Model

## Security Principles
Annapurna Rebuilt implements defense-in-depth across authentication, tenant isolation, device ingestion, database persistence, and AI integrations.

---

## 1. Authentication & Session Security
- **Algorithm:** Cryptographically signed session tokens using HMAC-SHA256 (`src/lib/auth`).
- **Configuration Boundary:** In production (`NODE_ENV === "production"`), `SESSION_SECRET` must be explicitly configured with at least 32 characters; startup and secret resolution fail closed otherwise. Fallback defaults are strictly restricted to local development environments.
- **Runtime Validation:** Session payloads are strictly validated using Zod (`SessionPayloadSchema`), requiring valid string `userId`, `email`, supported `role`, and a finite integer timestamp for `exp`.
- **Exact Expiry Check:** Expiration is evaluated with strict integer boundary (`exp <= Math.floor(Date.now() / 1000)`). Non-numeric, null, missing, or past timestamps are rejected.
- **Oversized Token Rejection:** Tokens exceeding 4,096 characters are rejected immediately prior to decoding.
- **Constant-Time Verification:** Verified using constant-time string comparison (`crypto.timingSafeEqual`) after exact buffer length validation to prevent timing side-channel attacks.
- **Cookie Attributes:** Stored in `httpOnly`, `SameSite=Lax`, and `Secure` (in production) cookies, mitigating XSS token exfiltration.
- **Password Storage:** Salted, constant-time bcrypt hashing with 10 rounds (`bcryptjs`).
- **Administrative Provisioning:** Dedicated provisioning utility (`scripts/provision-admin.ts`) enforces minimum 12-character passwords requiring uppercase, lowercase, numbers, and special characters.

---

## 2. Multi-Tenant Authorization & Tenant Boundary Defense
- **Explicit Multi-Tenant Scoping:** All database queries and mutations are filtered by the authenticated user's `organizationId`.
- **Centralized Guard:** `assertOrgAccess(userId, userRole, targetOrgId, options)` validates tenant membership before performing sensitive operations.
- **Administrative Separation:** Platform administrators (`ADMIN`) can inspect organization telemetry and platform health under `READ_AUDIT` mode, but are explicitly blocked from executing operational mutations (e.g. creating shipments, accepting offers) without active membership in that organization.
- **Driver Scoping:** Drivers are restricted to viewing only operational information for shipments assigned to them.
- **Rescue Marketplace Isolation:** Competing rescue partners cannot inspect each other's submitted bids, prices, or operational details.

---

## 3. IoT Edge Hardware Security
- **Per-Device Cryptographic Credentials:** Each edge device authenticates via a unique Bearer API key (`dev_key_apn_...`).
- **One-Way SHA-256 Hashing:** Raw device API keys are never stored in the database. Only their SHA-256 hex hashes are persisted.
- **Replay & Sequence Attack Mitigation:** Composite unique constraint `@@unique([deviceId, sequence])` rejects re-transmitted sequence IDs.
- **Clock Drift Bounds:** Telemetry with timestamps backdated into the future (> 10 minutes forward clock skew) is rejected immediately (`FUTURE_TIMESTAMP_REJECTED`).
- **Ingestion Boundaries:** Strict Zod validation guarantees bounds on temperature (-60°C to +80°C), humidity (0-100%), and coordinates (-90 to 90 lat, -180 to 180 lng).
- **Database-Level Invariant Constraints:** PostgreSQL check constraints enforce that shipment `tempMin < tempMax`, partner capacity is positive, partner temperature limits are valid, and offer amounts/capacities are positive numbers.

---

## 4. AI Guardrails (Human-in-the-Loop)
- **Zero Autonomous Dispatch:** AI models are never permitted to autonomously issue purchase orders, bind contracts, accept rescue offers, or dispatch vehicles.
- **Strict Server-Side Key Isolation:** Provider credentials (`GEMINI_API_KEY`) are kept exclusively in server environment variables. Zero client exposure.
- **Bounded Latency & Timeouts:** Provider requests enforce a strict 5000ms AbortController timeout. If unavailable, the deterministic heuristic engine handles incident calculations seamlessly.
- **Structured Schema Validation:** Model outputs are parsed with Zod schemas to guarantee type and format constraints.
- **Prompt Injection Defense:** Shipment titles and notes are treated as untrusted data and delimited in JSON payloads.

---

## 5. Append-Only Operational Audit History & Database Safety
- **Application-Level Append-Only Ledger:** Operational events (`SHIPMENT_CREATED`, `ALERT_ACKNOWLEDGED`, `RESCUE_OFFER_ACCEPTED`, `PARTNER_ONBOARDING_COMPLETED`, etc.) are written exclusively through append operations. No update or delete APIs exist in the application. (Note: this is application-level append-only history, not cryptographic hash-chained or hardware WORM storage).
- **Destructive Operation Guards:** Destructive database reset (`scripts/reset-demo.ts`) is strictly guarded (`assertSafeForDestructiveReset`), refusing execution if `NODE_ENV === "production"`, if `ALLOW_DESTRUCTIVE_RESET !== "true"`, or if the target database URL contains production domain indicators.
- **Safe Initializations:** Production and staging environments use versioned migrations (`npx prisma migrate deploy`) and non-destructive initialization (`scripts/init-essential.ts`), preserving all existing tenant data.

---

## 6. Known Limitations
1. **Physical GPS Spoofing:** Without cryptographic GNSS hardware modules, reported device coordinates are software-attested. In mission-critical deployments, cellular triangulation or signed GNSS receiver firmware should be incorporated.
2. **Email Transport:** Account confirmation and email notifications are prepared through abstraction adapters; production deployments require configuring transactional SMTP credentials (e.g. Resend, SendGrid, Amazon SES).
