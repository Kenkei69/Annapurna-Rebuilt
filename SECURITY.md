# Annapurna Rebuilt — Security Architecture & Threat Model

## Security Principles
Annapurna Rebuilt implements defense-in-depth across authentication, authorization, ingestion, database persistence, and AI integrations.

---

## 1. Authentication & Session Security
- **Algorithm:** Cryptographically signed session tokens using HMAC-SHA256 (`src/lib/auth`).
- **Signature Verification:** Verified using constant-time string comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
- **Cookie Attributes:** Stored in `httpOnly`, `SameSite=Lax`, `Secure` (in production) cookies, mitigating XSS token exfiltration.
- **Password Storage:** Salted, constant-time bcrypt hashing with 10 rounds (`bcryptjs`).
- **No Hardcoded Demo Credentials in Production:** Seed credentials are only injected when explicitly executing `npm run db:seed` in development or test environments.

---

## 2. Multi-Tenant Authorization
- **No Direct Object Reference Vulnerabilities (IDOR):** All database reads and mutations are filtered by the authenticated user's `organizationId`.
- **Centralized Guard:** `assertOrgAccess(userId, userRole, targetOrgId)` validates tenancy before performing sensitive operations.
- **Platform Administrator Exemption:** `ADMIN` users can audit cross-tenant health metrics without granting unmonitored write access to private fleet records.

---

## 3. IoT Edge Hardware Security
- **Per-Device Cryptographic Credentials:** Each physical or simulated edge device authenticates via a unique Bearer API key (`dev_key_apn_...`).
- **One-Way SHA-256 Hashing:** Raw device API keys are never stored in the database. Only their SHA-256 hex hashes are persisted.
- **Replay & Sequence Attack Mitigation:** Composite unique constraint `@@unique([deviceId, sequence])` rejects re-transmitted sequence IDs.
- **Clock Drift Bounds:** Telemetry with timestamps backdated into the future (> 10 minutes forward clock skew) is rejected immediately (`FUTURE_TIMESTAMP_REJECTED`).
- **Ingestion Boundaries:** Strict Zod validation guarantees bounds on temperature (-60°C to +80°C), humidity (0-100%), and coordinates (-90 to 90 lat, -180 to 180 lng).

---

## 4. AI Guardrails (Human-in-the-Loop)
- **Zero Autonomous Dispatch:** AI models are never permitted to autonomously issue purchase orders, bind contracts, accept rescue offers, or dispatch vehicles.
- **Strict Server-Side Key Isolation:** Provider credentials (`GEMINI_API_KEY`) are kept exclusively in server environment variables. Zero client exposure.
- **Bounded Latency & Timeouts:** Provider requests enforce a strict 5000ms AbortController timeout. If unavailable, the deterministic heuristic engine handles incident calculations seamlessly.
- **Structured Schema Validation:** Model outputs are parsed with Zod schemas to guarantee type and format constraints.
- **Prompt Injection Defense:** Shipment titles and notes are treated as untrusted data and delimited in JSON payloads.

---

## 5. Known Limitations
1. **Physical GPS Spoofing:** Without cryptographic GPS hardware modules, simulated and real devices transmit reported coordinates. In mission-critical deployments, cellular cell-tower triangulation or signed GNSS receiver firmware should be incorporated.
2. **Email Transport:** Account confirmation and email notifications are prepared through abstraction adapters; production deployments require configuring transactional SMTP credentials (e.g. Resend, SendGrid, Amazon SES).
