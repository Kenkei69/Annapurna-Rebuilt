# Annapurna Rebuilt — Verification & Testing Report

## Testing Philosophy & Strategy
Annapurna Rebuilt relies on rigorous, automated tests covering all critical invariants:
- **Tenant Isolation:** Proof that Organization B cannot view or mutate Organization A's shipments, devices, alerts, or offers.
- **Hardware Authentication:** SHA-256 token verification and rejection of forged API keys.
- **Ingestion Boundaries:** Sequence deduplication, forward clock drift rejection (> 10m), out-of-bounds sensor values.
- **State Machine Transitions:** Allowed vs rejected lifecycle state changes.
- **Single-Winner Concurrency:** Transaction-safe rescue offer acceptance preventing race conditions.
- **Deterministic Alert Engine:** Hysteresis and sustained thermal breach detection.
- **AI Fallback:** Safe fallback to the deterministic expert system when external providers are offline.

---

## Automated Test Results

To execute all unit and integration tests:
```bash
npm test
```

### Verified Test Suites (36 / 36 Passing):
```
✔ Partner Onboarding - Real onboarding lifecycle and bid qualification invariant
✔ Cargo Rescue Concurrency - True PostgreSQL concurrent acceptance race condition
✔ Cargo Rescue Concurrency - Idempotent re-acceptance of the same winning offer
✔ Priority 4: Rescue Lifecycle, Suitability Validation, Expiry Persistence & Atomic Completion
✔ Shipment Authorization & Data Exposure - Comprehensive Isolation Policy
✔ Priority 2 & 3: Telemetry Ingestion, Out-of-Order Safety, Simulator Isolation & Alert Lifecycle
✔ Integration Workflow: Complete End-to-End Operator -> Telemetry -> Alert -> Rescue Journey
✔ Shipment State Machine - Enforces valid transitions
✔ AI Heuristic Engine - Correctly computes warming gradient and action plan
✔ Auth Module - Password hashing and verification
✔ Auth Module - Session Token creation and valid verification
✔ Auth Module - Production secret configuration enforcement
✔ Auth Module - Tampered token signature is rejected safely
✔ Auth Module - Tampered payload with original signature is rejected
✔ Auth Module - Expired token and exact expiry boundary are rejected
✔ Auth Module - Non-numeric, null, missing, or invalid expiry is rejected
✔ Auth Module - Malformed user identifier or unsupported role is rejected
✔ Auth Module - Oversized tokens and malformed encodings are rejected safely
✔ Cargo Rescue Concurrency - Single accepted offer guarantees mutual exclusion
✔ Database Safety - Refuses destructive reset in production environment
✔ Database Safety - Refuses destructive reset without explicit flag
✔ Database Safety - Refuses destructive reset if database URL is missing
✔ Database Safety - Refuses reset targeting a database with production indicators
✔ Database Safety - Credentials with test keywords do not bypass production database protection
✔ Database Safety - Allows reset only for explicitly designated local/test database
✔ Database Configuration - getDatabaseUrl fails closed when DATABASE_URL is unset
✔ Admin Provisioning - Password policy requires minimum 12 chars with complexity
✔ Device Authentication - Accepts valid provisioned API key
✔ Device Authentication - Rejects invalid or mismatched API key
✔ Device Authentication - Rejects non-existent device identifier
✔ Telemetry Module - Valid telemetry payload passes schema
✔ Telemetry Module - Out-of-bounds temperature is rejected
✔ Telemetry Module - Device API key hashing is deterministic SHA-256
✔ Telemetry Edge Cases - Future timestamps (> 10m drift) are rejected
✔ Telemetry Edge Cases - Sequence deduplication prevents duplicate row creation
✔ Telemetry Isolation - Ingesting simulated telemetry into operational device is rejected

ℹ tests 36
ℹ pass 36
ℹ fail 0
```

---

## Continuous Integration Pipeline (`ci/ci.yml`)

The repository includes a complete GitHub Actions CI pipeline configuration in `ci/ci.yml` (deployable to `.github/workflows/ci.yml`) running on `ubuntu-latest` with a dedicated PostgreSQL 16 service container:
1. **Linting & Code Quality:** `npm run lint` (ESLint Next.js core-web-vitals)
2. **Type Checking:** `npx tsc --noEmit`
3. **Database Migrations:** `npx prisma migrate deploy`
4. **Database Seeding & Invariant Verification:** `npm run db:init:essential`
5. **Automated Test Suite:** `npm test` (all 36 unit and integration test assertions)
6. **Production Build:** `npm run build` (Next.js Turbopack application bundle)

---

## End-to-End Operational Journey
The complete operational lifecycle was verified in `tests/integration/workflow.test.ts`:
1. **Provisioning:** Operator provisions Reefer Vehicle (`Volvo FE Electric`) and Edge Device (`DEVICE-TEST-...`) generating a cryptographic API key.
2. **Shipment Dispatch:** Operator registers a pharmaceutical shipment (`Vaccines & Biologics Express`, 2.0°C - 6.0°C).
3. **Normal Telemetry Ingestion:** Simulator injects compliant reading (3.5°C). Shipment transitions to `IN_TRANSIT`.
4. **Deduplication Check:** Repeated packet with identical sequence is idempotently ignored (`deduplicated: true`).
5. **Thermal Breach:** Sensor injects breach temperature (7.5°C). Deterministic alert rule triggers `TEMP_HIGH_BREACH`. Shipment moves to `ALERTED`.
6. **Incident Acknowledgment:** Operator enters audit notes acknowledging the incident. Alert moves to `ACKNOWLEDGED`.
7. **Cargo Rescue Broadcast:** Operator broadcasts a Rescue Opportunity with authorized budget (₹25,000).
8. **Partner Bidding:** Competing partners submit offers (Offer 1: ₹18,000; Offer 2: ₹22,000).
9. **Atomic Acceptance:** Operator accepts Offer 1. PostgreSQL transaction marks Offer 1 `ACCEPTED`, Offer 2 `REJECTED`, and binds `acceptedOfferId`.
10. **Milestones & Closure:** Partner records dispatch and arrival milestones. Operator records final verification notes. Shipment transitions to `RESCUED`.
11. **Immutable Audit Verification:** Audit trail records all 5 critical events with actor email, timestamp, and metadata.
12. **Tenant Boundary Assertion:** Competitor organization is denied access (`ORG_ACCESS_DENIED`).

---

## Rendered Page Screenshots
Visual verification was captured across Desktop (1440px) and Mobile (375px) viewports:
- `landing-desktop.png` & `landing-mobile.png`: Public product presentation and demo credentials
- `login-desktop.png`: Accessible sign-in with one-click demo personas
- `dashboard-desktop.png` & `dashboard-mobile.png`: Fleet control with live thermal breach banners
- `shipments-desktop.png`: Filterable registry and dispatch modal
- `alerts-desktop.png`: Deterministic incident management with acknowledgment controls
- `rescue-desktop.png`: Emergency cargo marketplace and milestone timeline
- `simulator-desktop.png`: Interactive scenario injector (Normal, Warming, Door Ajar, Offline, Replay)
- `audit-desktop.png`: Immutable operational ledger with JSON payload inspectability
