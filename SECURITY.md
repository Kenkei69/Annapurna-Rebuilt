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
- **Unified Resource Authorization Policy (`src/lib/auth/policy.ts`):** A single, shared authorization policy is used identically across both API routes and server-rendered pages.
  - Operators receive access only through verified organization membership.
  - Drivers receive access only to shipments explicitly assigned to them.
  - Rescue Partners receive visibility only for open bidding opportunities or their own accepted assignments; competitor bids, budgets, and internal notes are strictly redacted.
  - Missing organization context fails closed (`FAIL_CLOSED_NO_ACCESS`); null lookups never produce unrestricted queries.
- **Zero Credential Hash Serialization:** Server components and API endpoints utilize explicit Prisma field selections that never select, serialize, or pass `passwordHash`, `apiKeyHash`, or cryptographic secrets into client components or API responses.
- **Centralized Guard:** `assertOrgAccess(userId, userRole, targetOrgId, options)` validates tenant membership before performing sensitive operations.
- **Administrative Separation:** Platform administrators (`ADMIN`) can inspect organization telemetry and platform health under `READ_AUDIT` mode, but are explicitly blocked from executing operational mutations (e.g. creating shipments, accepting offers, running simulations) without active membership in that organization.

---

## 3. IoT Edge Hardware & Simulation Isolation
- **Per-Device Cryptographic Credentials:** Each edge device authenticates via a unique Bearer API key (`dev_key_apn_...`).
- **One-Way SHA-256 Hashing:** Raw device API keys are never stored in the database. Only their SHA-256 hex hashes are persisted.
- **Hardware Separation & Simulation Protection:** Devices maintain an explicit `isSimulated` database flag. Ingesting simulated telemetry into an operational hardware device is rejected (`SIMULATION_NOT_PERMITTED`). Operational hardware cannot be updated by simulation scenarios.
- **Environment Simulator Guard:** The simulator is gated by `ENABLE_SIMULATOR`. In production (`NODE_ENV === "production"`), simulation is disabled by default unless explicitly configured (`ENABLE_SIMULATOR=true`).
- **Replay & Sequence Attack Mitigation:** Composite unique constraint `@@unique([deviceId, sequence])` rejects re-transmitted sequence IDs. Concurrently arriving duplicates are handled idempotently via Prisma `P2002` exception handling.
- **Out-of-Order Safety & Status Preservation:** Telemetry readings timestamped earlier than the shipment's current `latestRecordedAt` are recorded in the audit log but are prevented from rolling back live shipment temperature, coordinates, or advancing statuses.
- **Ambiguous Device Assignment Prevention:** If a device is concurrently assigned to multiple active shipments, ingestion fails closed immediately (`AMBIGUOUS_DEVICE_ASSIGNMENT`).
- **Clock Drift Bounds:** Telemetry with timestamps backdated into the future (> 10 minutes forward clock skew) is rejected immediately (`FUTURE_TIMESTAMP_REJECTED`).
- **Ingestion Boundaries:** Strict Zod validation guarantees bounds on temperature (-60°C to +80°C), humidity (0-100%), and coordinates (-90 to 90 lat, -180 to 180 lng).

---

## 4. Cold-Chain Alert Lifecycle & Escalation
- **Atomic Telemetry & Alert Evaluation:** Telemetry insertion and alert evaluation execute inside a single PostgreSQL transaction.
- **Deterministic Escalation:** Sustained temperature breaches (3 consecutive readings exceeding safe threshold) automatically escalate from `TEMP_HIGH_BREACH` to `SUSTAINED_BREACH` (CRITICAL severity), linking the prior alert via `escalatedFromId`.
- **Deduplication:** Prevents duplicate active alerts for the same condition on the same shipment.
- **Safe Alert Resolution Guard:** Resolving a thermal alert requires verifying that the cargo temperature has returned to the safe operating band; otherwise, an explicit audit `overrideReason` of at least 5 characters is strictly required.
- **Missing Telemetry Detection:** Background detection service (`detectMissingTelemetry`) identifies active shipments that have not transmitted a heartbeat within the expected window (e.g. 30 minutes).

---

## 5. Rescue Marketplace Concurrency & Transaction Integrity
- **PostgreSQL Row-Level Locking:** All state transitions on `RescueOpportunity` (offer acceptance, milestone logging, completion) acquire an exclusive row lock (`SELECT ... FOR UPDATE`).
- **Mutual Exclusion & Idempotence:** Eliminates race conditions during concurrent bid acceptance. Winning offer is accepted, competing offers are atomically rejected.
- **Suitability Validation:** Offer acceptance verifies that `capacityOfferedKg >= cargoWeightKg` and that the partner facility's operating temperature envelope envelops the cargo requirement.
- **Clean Offer Expiration:** Expired offers (`validUntil <= now`) are persisted as `EXPIRED` in an autonomous query so the status update is preserved even when transaction rollback occurs.
- **Atomic Operation Conclusion:** `completeRescue` atomically transitions the opportunity to `COMPLETED` and the shipment to `RESCUED` together.

---

## 6. AI Guardrails (Human-in-the-Loop)
- **Zero Autonomous Dispatch:** AI models are never permitted to autonomously issue purchase orders, bind contracts, accept rescue offers, or dispatch vehicles.
- **Strict Server-Side Key Isolation:** Provider credentials (`GEMINI_API_KEY`) are kept exclusively in server environment variables. Zero client exposure.
- **Bounded Latency & Timeouts:** Provider requests enforce a strict 5000ms AbortController timeout. If unavailable, the deterministic heuristic engine handles incident calculations seamlessly.
- **Structured Schema Validation:** Model outputs are parsed with Zod schemas to guarantee type and format constraints.
- **Prompt Injection Defense:** Shipment titles and notes are treated as untrusted data and delimited in JSON payloads.

---

## 7. Append-Only Operational Audit History & Structural Database Safety
- **Application-Level Append-Only Ledger:** Operational events (`SHIPMENT_CREATED`, `ALERT_ACKNOWLEDGED`, `RESCUE_OFFER_ACCEPTED`, `PARTNER_ONBOARDING_COMPLETED`, etc.) are written exclusively through append operations.
- **Structural URL Database Safety Guard:** Destructive database reset (`scripts/reset-demo.ts`) parses `DATABASE_URL` structurally via the `URL` object, independently verifying hostname and database name. Passwords, usernames, and query parameters are never evaluated as safety evidence. Reset operations strictly refuse execution if targeting production cloud hosts (AWS RDS, Supabase, Neon) or databases outside the explicit disposable database whitelist (`annapurna_dev`, `annapurna_test`).
- **Safe Initializations:** Production and staging environments use versioned migrations (`npx prisma migrate deploy`) and non-destructive initialization (`scripts/init-essential.ts`), preserving all existing tenant data.

---

## 6. Known Limitations
1. **Physical GPS Spoofing:** Without cryptographic GNSS hardware modules, reported device coordinates are software-attested. In mission-critical deployments, cellular triangulation or signed GNSS receiver firmware should be incorporated.
2. **Email Transport:** Account confirmation and email notifications are prepared through abstraction adapters; production deployments require configuring transactional SMTP credentials (e.g. Resend, SendGrid, Amazon SES).
