# Annapurna Rebuilt — Cold-Chain Integrity & Autonomous Cargo-Rescue Platform

**Annapurna Rebuilt** is an original, production-grade cold-chain monitoring and cargo-rescue platform. Designed for logistics fleets transporting perishable goods (pharmaceuticals, vaccines, dairy, seafood, and fresh produce), the system pairs continuous IoT sensor telemetry ingestion with deterministic thermal breach detection, explainable AI incident triage, and a transaction-safe cargo rescue marketplace.

> **Provenance & Authorship Notice:**  
> Developed and maintained by **Kenkei69** with AI assistance. This codebase is a completely fresh, separate implementation built from explicit functional requirements, with its own architecture, database schema, user interface, deterministic alerting rules, and hardware firmware. No source code, diagrams, firmware, or proprietary assets were copied or translated from earlier repositories. See [`PROVENANCE.md`](./PROVENANCE.md) and [`LICENSING_DECISION.md`](./LICENSING_DECISION.md).

---

## 1. Key Platform Capabilities

### Phase 1: Reliable Core Cold-Chain Monitoring
- **Multi-Tenant Scoping:** Explicit organization isolation across Fleet Operators, Drivers, Rescue Partners, and Administrators. Competitor fleets cannot access each other's vehicles, shipments, or telemetry.
- **Edge Device Ingestion Contract:** Robust `POST /api/telemetry/ingest` endpoint supporting per-device SHA-256 API key authentication, sequence counter monotonicity, duplicate/replay packet suppression, and forward clock drift protection (> 10 min skew rejection).
- **Deterministic Alert Engine:** Transparent, deterministic threshold rules (`TEMP_HIGH_BREACH`, `TEMP_LOW_BREACH`, `SUSTAINED_BREACH`, `HUMIDITY_BREACH`, `SENSOR_OFFLINE`) with temporal hysteresis to prevent alert storms.
- **Audit Logging:** Immutable append-only audit trail recording every security, state transition, and operational mutation.
- **Interactive Simulator:** Built-in scenario injector (`NORMAL`, `GRADUAL_WARMING`, `DOOR_AJAR`, `SENSOR_OFFLINE`, `REPLAY_DUPLICATE`) clearly tagged with `isSimulated: true`.

### Phase 2: Transaction-Safe Cargo-Rescue Coordination
- **Distress Declaration:** When a refrigerated vehicle suffers catastrophic mechanical failure, dispatch broadcasts a rescue opportunity with cargo weight, temperature tolerances, and emergency budget.
- **Partner Bidding:** Regional cold-storage facilities and emergency reefers submit competitive quotes (price, capacity, ETA, storage type).
- **Atomic Acceptance:** Winning offer acceptance executes inside an atomic PostgreSQL database transaction, instantly assigning the rescue, transitioning shipment status to `RESCUE_PENDING`, and rejecting competing bids.
- **Traceable Timeline:** Milestone tracking from dispatch interception to cold chamber logging and final salvage verification.

### Phase 3: Explainable AI Incident Assistance
- **Thermal Diagnostic Engine:** Computes warming gradient / velocity (°C / hour) and calculates estimated minutes until critical temperature breach.
- **Operational Action Plans:** Generates concrete operator guidance and drafts concise, actionable driver dispatch messages.
- **Human Approval Gate:** AI output is prominently displayed with explicit uncertainty disclaimers and requires human operator confirmation before consequential operational actions.
- **Deterministic Fallback:** Robust mathematical heuristic fallback ensures full availability even when external AI APIs are offline or reach their 5-second timeout.

---

## 2. Seeded Demonstration Personas

To test the multi-tenant architecture and distinct role workflows immediately, four pre-configured personas are available in the local database:

| Persona | Email | Password | Organization | Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Fleet Operator** | `operator@transcold.com` | `Operator123!` | TransCold Express Logistics | Dispatch shipments, monitor alerts, initiate rescue, review AI triage |
| **Reefer Driver** | `driver.raj@transcold.com` | `Driver123!` | TransCold Express Logistics | View assigned active shipment, live temperature, driver notices |
| **Rescue Partner** | `director@sahyadricold.com` | `Partner123!` | Sahyadri Cold Storage Hub | Discover distress broadcasts, submit capacity bids, log rescue milestones |
| **Platform Admin** | `admin@annapurna.local` | `AdminPass123!` | System Administration | Cross-tenant governance, edge device provisioning, audit trail review |

---

## 3. Technology Stack

- **Runtime & Framework:** Node.js & Next.js 16 (App Router, Server & Client Components, Turbopack)
- **Language:** TypeScript 5 (Strict mode)
- **Database & Persistence:** PostgreSQL with Prisma ORM v6
- **Styling:** Tailwind CSS v4 with custom responsive design system
- **Validation:** Zod schemas at all HTTP ingestion boundaries and API routes
- **Testing:** Native Node.js test runner (`tsx --test`) with 16 automated integration and unit test suites
- **Firmware:** Arduino C++ for ESP32 with NVS sequence counter persistence

---

## 4. Getting Started

### Prerequisites
- Node.js >= 20.x
- PostgreSQL database instance
- npm >= 10.x

### Installation & Local Setup

1. **Clone or navigate to the repository:**
   ```bash
   cd /home/runner/workspace/Annapurna-Rebuilt
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and configure your PostgreSQL connection:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/annapurna_db?sslmode=disable"
   SESSION_SECRET="annapurna_super_secure_hmac_secret_key_minimum_32_characters"
   NODE_ENV="development"
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Sync Schema & Seed Database:**
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Run Automated Test Suite:**
   ```bash
   npm test
   ```

6. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

7. **Production Build:**
   ```bash
   npm run build
   npm start
   ```

---

## 5. Repository Structure

```
Annapurna-Rebuilt/
├── firmware/
│   ├── esp32_annapurna_sensor/   # C++ ESP32 telemetry reference firmware
│   └── README.md                 # Hardware ingestion protocol & flashing guide
├── prisma/
│   ├── schema.prisma             # 13 normalized PostgreSQL models
│   └── seed.ts                   # Realistic multi-tenant seed dataset
├── src/
│   ├── app/                      # Next.js App Router (pages & API routes)
│   │   ├── admin/                # Platform governance
│   │   ├── alerts/               # Alert center & resolution
│   │   ├── api/                  # Ingestion, auth, rescue, AI endpoints
│   │   ├── audit/                # Immutable platform audit trail
│   │   ├── dashboard/            # Operational command center
│   │   ├── devices/              # Edge IoT device registry & key provisioning
│   │   ├── fleet/                # Reefer vehicle management
│   │   ├── rescue/               # Cargo rescue coordination marketplace
│   │   ├── shipments/            # Shipment tracking, detail & AI assistant
│   │   └── simulator/            # Interactive sensor scenario injector
│   ├── components/               # Reusable UI components & SVG telemetry chart
│   └── lib/                      # Core business logic (auth, telemetry, alerts, rescue, AI)
├── tests/
│   ├── integration/              # End-to-end multi-role journey tests
│   └── unit/                     # Auth, state machine, AI heuristic, edge case tests
├── ARCHITECTURE.md               # Module decomposition & concurrency design
├── LICENSING_DECISION.md         # Dependency analysis & licensing options
├── PROVENANCE.md                 # Authorship disclosure & dependency inventory
└── package.json
```
