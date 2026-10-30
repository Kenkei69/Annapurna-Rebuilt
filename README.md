# Annapurna Rebuilt

**Cold-chain integrity monitoring and transactional cargo-rescue platform.**

Annapurna Rebuilt monitors temperature-sensitive consignments in transit, detects refrigeration anomalies and telemetry dropouts, and enables fleet operators to coordinate emergency cargo transfers with verified cold-storage partners before spoilage occurs.

---

## Problem & Approach

### The Problem
Transporting temperature-critical goods—biologics, vaccines, dairy, seafood, and fresh produce—requires continuous thermal corridor compliance. When in-transit refrigeration units fail or lose power, operators face a narrow time window before cargo passes irreversible spoilage thresholds. Traditional tracking systems trigger passive warnings or report delayed updates, leaving dispatchers without actionable mechanisms to locate and execute emergency offloading in the field.

### The Approach
Annapurna Rebuilt combines continuous IoT edge monitoring with an on-demand cargo-rescue marketplace:
1. **Edge Verification:** Endpoints authenticate sensor telemetry, enforce sequence continuity, and evaluate readings against strict thermal boundaries.
2. **Deterministic Incident Detection:** Rule engines identify threshold breaches, sustained warming, and heartbeat dropouts without external service dependencies.
3. **Emergency Rescue Coordination:** When a breach threatens cargo, operators broadcast transfer requests to nearby cold-storage warehouses and backup reefers, executing assignments through PostgreSQL transactions that prevent double-booking.

---

## Core Capabilities

- **Interactive Fleet Command Console:** Leaflet-powered operational map (CartoDB Voyager tiles) with synchronized selection across map pins, tabular rows, and detail inspection panels. Features URL-synchronized status, cargo, and temperature filtering, active route corridor polylines, and payload weight tracking.
- **Hardened IoT Ingestion Boundary:** Edge device authentication uses deterministic SHA-256 token hashing. Ingestion enforces numeric envelopes (-60°C to +80°C), forward clock drift rejection (> 10 min), and sequence deduplication (`@@unique([deviceId, sequence])`). Stale or out-of-order packets are stored without rolling back live shipment status.
- **Deterministic Alert Engine & Gap Scanner:** Evaluates upper and lower threshold violations with configurable hysteresis recovery (0.5°C). A scheduled scanner (`POST /api/telemetry/evaluate-gaps`) detects missing-heartbeat conditions using cursor-based batching and distributed lease locks to prevent overlapping executions.
- **Transactional Rescue Marketplace:** Operators broadcast rescue opportunities specifying cargo parameters and budget bounds. Onboarded partners submit capacity bids and counter-offers. Acceptance uses PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) to guarantee atomic single-winner assignment while rejecting competing bids.
- **Private Cargo Photo Inspection:** Multi-format visual evidence upload (PNG, JPEG, WebP) validated for MIME headers, magic bytes, dimensions (up to 4096px), and payload size (≤ 5 MB). Authenticated image streaming enforces tenant and winning-partner authorization with directory traversal protections.
- **Incident Advisory & Multi-Language Support:** Analyzes thermal gradients (+°C/10 min) to estimate time to spoilage and draft driver notifications across 7 Indian languages (English, Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati). Includes browser speech synthesis controls, hourly query budgets, and offline fallback to a deterministic expert heuristic.

---

## Operational Workflow

```mermaid
flowchart TD
    subgraph Ingestion["1. Telemetry Ingestion"]
        Sensor["IoT Edge Sensor / Simulator"] -->|POST /api/telemetry/ingest| Gateway["Ingestion Boundary"]
        Gateway -->|Validate Token, Envelopes & Sequence| Dedup{"Deduplicated?"}
        Dedup -->|Yes: Ignore Replay| Drop["Idempotent Response"]
        Dedup -->|No: Valid Sequence| DB[("PostgreSQL Store")]
    end

    subgraph Evaluation["2. Rule Evaluation & Alerts"]
        DB --> RuleEngine["Deterministic Alert Engine"]
        RuleEngine -->|Threshold Breach / Heartbeat Gap| Alert["Active Alert Created\n(Shipment -> ALERTED)"]
        Alert --> Advisory["Advisory Engine\n(Thermal Velocity & Action Plan)"]
    end

    subgraph Rescue["3. Emergency Cargo Rescue"]
        Alert --> Operator["Fleet Operator"]
        Operator -->|Broadcast Transfer Request| Opportunity["Open Rescue Opportunity"]
        Opportunity --> Partners["Cold-Storage Partners"]
        Partners -->|Submit Bid / Counter-Offer| Negotiation["Negotiation Hub"]
        Operator -->|Accept Winning Offer| TxAccept["PostgreSQL Transaction\n(SELECT ... FOR UPDATE)"]
        TxAccept -->|Single Winner Enacted| Winner["Offer ACCEPTED\nCompeting Offers REJECTED"]
        Winner --> Transfer["Offloading Milestones Recorded"]
        Transfer --> Rescued["Shipment Marked RESCUED"]
    end

    subgraph Audit["4. Verification & Ledger"]
        Rescued --> AuditLog["Append-Only Audit Ledger"]
    end
```

---

## Architecture & Technology Stack

| Layer | Technologies | Architectural Responsibility |
| :--- | :--- | :--- |
| **Application Framework** | Next.js 16 (App Router, Turbopack, React 19) | Server-rendered pages, edge route handlers, client console components. |
| **Data & Persistence** | PostgreSQL 15+ via Prisma ORM 6 | Single source of record, transactional row locking, constraints, audit events. |
| **Schema Validation** | Zod 3.24 | Trust-boundary contract enforcement for API routes, device payloads, and mutations. |
| **Mapping & UI** | Leaflet 1.9, Tailwind CSS 4, Lucide React 1.16 | CartoDB Voyager tiles, semantic styling, dark-mode, responsive drawer panels. |
| **Auth & Security** | HMAC-SHA256 session tokens, `bcryptjs` | HTTP-only signed cookies, constant-time verification, tenant/role isolation. |
| **Testing Harness** | Node.js native test runner (`node:test`, `tsx`) | Zero-dependency execution for unit assertions, concurrency tests, and browser journeys. |

---

## Quickstart & Setup Guide

### Prerequisites
- Node.js `20.x` or `22.x`
- PostgreSQL `15+` or `16+` instance
- npm `10+`

### 1. Clone & Configure Environment
```bash
git clone https://github.com/Kenkei69/Annapurna-Rebuilt.git
cd Annapurna-Rebuilt
cp .env.example .env
```
Configure `DATABASE_URL` and `SESSION_SECRET` (minimum 32 characters in production) in `.env`.

### 2. Install Dependencies & Deploy Migrations
```bash
npm install
npm run db:migrate
npm run db:generate
```

### 3. Initialize Database Records
Initialize required administrative structures non-destructively:
```bash
npm run db:init-essential
```
For local development demo personas (idempotent upserts):
```bash
npm run db:seed
```

### 4. Start the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the console.

<details>
<summary><strong>Advanced Configuration & Seed Personas</strong></summary>

#### Environment Variables Reference
| Variable | Description | Required | Default / Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URL | Yes | `postgresql://user:pass@localhost:5432/annapurna_db` |
| `SESSION_SECRET` | HMAC cookie signing secret (min 32 chars) | Yes | 64-character random hex string |
| `ENABLE_SIMULATOR` | Enables the `/simulator` synthetic test route | No | `false` in production, `true` in development |
| `CRON_SECRET` | Bearer token for gap evaluation endpoint | Optional | Used by external cron to invoke `/api/telemetry/evaluate-gaps` |
| `GEMINI_API_KEY` | Google Gemini API key for incident advisory | Optional | If unset, falls back to deterministic expert heuristic |

#### Seed Personas (Local Development Only)
The development seed (`npm run db:seed`) provides test personas across operational roles:
- **Fleet Operator:** `operator@transcold.com` (TransCold Express Logistics)
- **Reefer Driver:** `driver.raj@transcold.com` (Assigned to active consignment corridor)
- **Rescue Partner:** `director@sahyadricold.com` (Sahyadri Agro Cold Storage)
- **Platform Admin:** `admin@annapurna.local` (System administration and audit inspection)

#### Dedicated Production Admin Provisioning
To create an administrative user under strict password rules (minimum 12 characters with mixed complexity):
```bash
ADMIN_EMAIL="admin@yourdomain.com" ADMIN_PASSWORD="YourStrongPassword123!" npm run db:provision-admin
```

</details>

---

## Verification & Status

### Automated Test Suite
Execute unit and integration test suites:
```bash
npm test
```
**Current Status:** 49 passing tests across 9 test suites verifying:
- **PostgreSQL Concurrency:** Concurrent partner acceptance verifying mutual exclusion via row locks ([`tests/integration/rescue_concurrency.test.ts`](./tests/integration/rescue_concurrency.test.ts)).
- **Tenant Isolation:** Access policy enforcement denying cross-tenant, unassigned driver, and non-winning partner queries ([`tests/integration/shipment_authorization.test.ts`](./tests/integration/shipment_authorization.test.ts)).
- **Ingestion & Out-of-Order Safety:** Duplicate rejection, clock drift guards, and stale packet preservation ([`tests/integration/telemetry_ingestion_and_simulation.test.ts`](./tests/integration/telemetry_ingestion_and_simulation.test.ts)).
- **Cargo Photos & Counter-Offers:** Image validation, private streaming, counter-offer state machine, and advisory query budgets ([`tests/integration/cargo_photos_and_counter_offers.test.ts`](./tests/integration/cargo_photos_and_counter_offers.test.ts)).

### Browser Journey Verification
An automated script exercises the application using headless Chromium via Chrome DevTools Protocol (CDP):
```bash
npm run test:browser
```
Validates real browser flows: Operator login, Leaflet map DOM rendering on `/fleet`, rescue listings on `/rescue`, compliance metrics on `/analytics`, dark-mode persistence on `/org`, and unauthenticated access on `/tracking`.

### Runtime Probes & Operational Boundaries
- **Process Liveness:** `GET /api/health` returns HTTP 200 `{ status: "ok" }`.
- **Dependency Readiness:** `GET /api/ready` validates database connectivity via `SELECT 1`, returning HTTP 200 or 503 degraded.
- **Edge Security Headers:** Ingress requests are stamped with `x-request-id` and defense-in-depth headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`).

### Implementation Boundaries & Configuration Dependencies
To maintain technical accuracy, the following boundaries reflect current implementation realities:
- **Cloud Database:** The repository does not include provisioned cloud database infrastructure. Running in production requires setting `DATABASE_URL` to an external PostgreSQL instance (e.g. Neon, Supabase, or AWS RDS).
- **Scheduled Monitoring:** The missing-heartbeat scanner (`/api/telemetry/evaluate-gaps`) is implemented and tested, but requires an external scheduling trigger (Vercel Cron, EventBridge) supplying the configured `CRON_SECRET`.
- **External Notifications:** Internal alert generation and audit logging are functional; carrier SMS and email delivery require provisioning third-party gateways (e.g. Twilio, SendGrid).
- **Consignment Transfers:** Rescue coordination operates on full consignment payloads; partial cargo splitting across multiple simultaneous rescue vehicles is not implemented.

---

## Documentation Index

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): System architecture, unified authorization policies, and module contracts.
- [`DATA_MODEL.md`](./DATA_MODEL.md): Relational schema, entity relationships, indexes, and state machine transitions.
- [`SETUP.md`](./SETUP.md): Step-by-step local development setup, prerequisites, and environment configuration.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md): Deployment instructions, migration procedures, and zero-downtime rollback strategy.
- [`TESTING.md`](./TESTING.md): Verification matrix, test inventory, and browser journey documentation.
- [`SECURITY.md`](./SECURITY.md): Threat model, credential hashing, session cryptography, and access policies.
- [`PROVENANCE.md`](./PROVENANCE.md): Authorship declaration, origin history, and licensing decision context.
- [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md): Dependency license disclosures.

---

## Maintainer & Licensing

- **Author & Maintainer:** Kenkei69
- **Implementation:** Developed by Kenkei69 with AI assistance.
- **Licensing Notice:** An open-source license has not been unilaterally attached on the maintainer's behalf. As described in [`LICENSING_DECISION.md`](./LICENSING_DECISION.md) and [`PROVENANCE.md`](./PROVENANCE.md), license selection is reserved for the repository owner. All underlying third-party runtime dependencies are permissively licensed (MIT, Apache-2.0, ISC).
