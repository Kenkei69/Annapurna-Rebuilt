# Annapurna Rebuilt

![Annapurna Rebuilt Banner](./docs/assets/banner.svg)

> **Cold-chain integrity monitoring and transactional cargo-rescue platform.**  
> *From in-transit thermal signals to atomic, coordinated cargo rescue.*

Annapurna Rebuilt monitors temperature-sensitive consignments in transit, detects refrigeration anomalies and telemetry dropouts through deterministic rules, and enables fleet operators to coordinate emergency cargo transfers with verified cold-storage partners before irreversible spoilage occurs.

---

## Table of Contents
- [Understand the Project in One Minute](#understand-the-project-in-one-minute)
- [The Problem & Approach](#the-problem-approach)
  - [The Cold-Chain Coordination Breakdown](#the-cold-chain-coordination-breakdown)
  - [The Annapurna Rebuilt Approach](#the-annapurna-rebuilt-approach)
  - [Capability & Implementation Boundaries](#capability-implementation-boundaries)
- [System Architecture](#system-architecture)
  - [High-Level Architecture Boundary](#high-level-architecture-boundary)
  - [Core Domain Modules](#core-domain-modules)
  - [Technology Stack Matrix](#technology-stack-matrix)
- [Operational Workflows](#operational-workflows)
  - [1. Complete Operational Lifecycle](#1-complete-operational-lifecycle)
  - [2. Telemetry Ingestion, Ordering & Deduplication](#2-telemetry-ingestion-ordering-deduplication)
  - [3. Alert Lifecycle, Hysteresis & Sensor Recovery](#3-alert-lifecycle-hysteresis-sensor-recovery)
  - [4. Rescue Bidding, Counter-Offer Negotiation & Atomic Acceptance](#4-rescue-bidding-counter-offer-negotiation-atomic-acceptance)
  - [5. Shared Authorization & Multi-Tenant Boundaries](#5-shared-authorization-multi-tenant-boundaries)
  - [6. Missing-Heartbeat Detection & Distributed Cursor Scanning](#6-missing-heartbeat-detection-distributed-cursor-scanning)
  - [7. Advisory Incident Intelligence & Speech Flow](#7-advisory-incident-intelligence-speech-flow)
  - [8. Developer Verification & Pipeline Flow](#8-developer-verification-pipeline-flow)
- [Engineering Decisions & Defensive Invariants](#engineering-decisions-defensive-invariants)
- [Role-Oriented User Journeys](#role-oriented-user-journeys)
- [Quickstart & Setup Guide](#quickstart-setup-guide)
- [Verification & Evidence](#verification-evidence)
- [Documentation Index](#documentation-index)
- [Authorship, Provenance & Licensing](#authorship-provenance-licensing)

---

## Understand the Project in One Minute

Annapurna Rebuilt is an integrated operations and incident coordination platform designed for cold-chain logistics. It replaces disconnected GPS trackers, manual phone calls, and passive temperature alarms with a structured, verified incident escalation and cargo-rescue workflow.

```
[IoT Edge Sensor] ──(Authenticated Telemetry)──► [Deterministic Ingestion Engine]
                                                               │
                                                 (Thermal Breach / Heartbeat Gap)
                                                               ▼
[Cold-Storage Partner] ◄──(Atomic Acceptance)── [Incident Management & Rescue Hub]
         │                                                     │
(Milestones / Handover)                                (Advisory AI Guidance)
         ▼                                                     ▼
[Shipment RESCUED] ─────────────────────────────► [Append-Only Audit Ledger]
```

- **The Users:** Fleet operators who manage reefer vehicles and active consignments; reefer drivers executing transit routes; commercial cold-storage facility operators providing emergency offload capacity; and platform administrators auditing tenant boundaries.
- **The Operational Inputs:** Cryptographically authenticated sensor telemetry (temperature, humidity, sequence numbers, coordinates); cargo parameters and critical tolerance envelopes; visual cargo condition photos; and partner capacity bids.
- **The Decisions the Platform Supports:** Escalating thermal breaches into formal operational alerts; calculating thermal warming velocity (+°C/10 min); drafting localized multilingual driver advisories; negotiating counter-offers with storage partners; and evaluating missing-heartbeat timeouts across active shipments.
- **The Recorded Outcomes:** Transaction-safe, single-winner rescue contracts backed by PostgreSQL row locks; milestoned offloading chains; immutable audit log entries; and tenant-scoped ESG carbon-offset metrics.

---

## The Problem & Approach

### The Cold-Chain Coordination Breakdown
Perishable and biological commodities—such as vaccines, biologics, dairy, seafood, and fresh produce—require strict temperature corridor compliance (e.g. 2.0°C to 6.0°C for pharmaceuticals; -20.0°C for frozen proteins).

When in-transit refrigeration units fail due to compressor trips, alternator dropouts, or door seal breaches, operators face an unforgiving time window before cargo passes irreversible thermal limits. Traditional logistics telematics suffer from three structural gaps:
1. **Passive Telematics:** Standard GPS units log readings to isolated dashboards emitting delayed batch alerts. By the time dispatchers notice, critical hours have elapsed.
2. **Coordination Black Hole:** When refrigeration fails on a highway corridor, dispatchers lack a verified directory of nearby cold-storage facilities with compatible temperature envelopes and available intake bays.
3. **Double-Booking & Manual Race Conditions:** Phone-based negotiations lead to ambiguous quotes, unconfirmed arrival windows, and catastrophic turnaways when facilities lack physical capacity.

### The Annapurna Rebuilt Approach
Annapurna Rebuilt resolves this breakdown by tightly coupling real-time telemetry verification directly with a transactional emergency offloading marketplace:
- **Native Ingestion Boundary:** Ingestion is handled natively over authenticated HTTPS endpoints. Telemetry is parsed, validated against clock drift, deduplicated, and evaluated against alert rules atomically in a single database transaction.
- **Deterministic Incident Escalation:** High breaches, sub-cooling risks, and sustained mechanical warnings are evaluated using transparent hysteresis thresholds. Active shipments transition into an explicit `ALERTED` state that highlights affected consignments on the operational console.
- **Atomic Single-Winner Bidding:** When an incident cannot be resolved on the road, operators broadcast a rescue opportunity to verified regional cold-storage partners. Partners bid with capacity and quoted rates. Acceptance is executed using PostgreSQL `SELECT ... FOR UPDATE` row locks, ensuring that only one partner contract is accepted while all competing offers are simultaneously rejected.

### Capability & Implementation Boundaries

| Capability | What the User Can Do | Implementation Boundary |
| :--- | :--- | :--- |
| **Fleet Console** | View live vehicle positions on CartoDB Leaflet maps; filter consignments by temperature, category, and status; paginate active lists; create consignments with payload weights. | Map renders verified coordinates from telemetry. Route corridors represent connected sensor waypoints; external turn-by-turn routing engines are not bundled. |
| **Edge Ingestion** | Devices transmit authenticated JSON packets over HTTPS with SHA-256 API keys; system enforces bounds, sequence deduplication, and out-of-order protection. | Handles individual sensor devices. Radio frequency mesh networks, cellular gateway SIM management, and hardware firmware provisioning execute outside this software boundary. |
| **Alert Engine** | Evaluates upper breach, lower breach, sustained warming, and compressor failures with 0.5°C hysteresis recovery; supports operator acknowledgment and override notes. | Internal state machine and in-app alerts are fully operational. External SMS/WhatsApp/Email carrier dispatch requires configuring third-party gateway API keys (Twilio/SendGrid). |
| **Missing Heartbeat** | Bounded scanner evaluates silent in-transit shipments; applies grace periods; creates `MISSING_TELEMETRY` alerts; auto-resolves when telemetry resumes. | Scanning logic and cursor batching are implemented and tested. Scheduled recurring invocation requires an external cron trigger supplying `CRON_SECRET`. |
| **Cargo Rescue** | Operators broadcast rescue opportunities; onboarded partners submit capacity bids; operators propose counter-offers; partner responds; atomic single-winner acceptance. | Manages commercial terms, quotes, and milestone records. Escrow payment settlement, banking rails, and automated financial fund transfers are not implemented. |
| **Cargo Photos** | Upload visual evidence (PNG, JPEG, WebP) with magic-byte and dimension verification; stream photos privately to fleet operators and winning rescue partners. | Local file storage relative to project root (`uploads/`). Cloud object storage integration (AWS S3, Cloudflare R2) is documented for serverless production deployments. |
| **Advisory Intelligence** | Compute thermal warming gradients (+°C/10 min); draft driver updates; translate guidance across 7 Indian languages; browser speech synthesis. | Advisory decision support only. The system does not autonomously commandeer vehicle steering, execute mechanical recalibration, or certify food safety. |
| **Tenant Isolation** | Multi-tenant RBAC (`ADMIN`, `OPERATOR`, `DRIVER`, `PARTNER`); driver isolation to assigned cargo; competitor bid redaction; strict credential hash omission. | Authorization policies fail closed without verified organization membership. Hardware-level physical server isolation is managed by the cloud host. |

---

## System Architecture

### High-Level Architecture Boundary

Annapurna Rebuilt is built as a **modular monolith** optimized for deployment on Vercel with PostgreSQL (e.g. Neon, Supabase, AWS RDS) as the authoritative persistence engine.

```mermaid
flowchart TD
    subgraph Client["Client Browser / Mobile PWA"]
        UI["Next.js App Router (React 19)"]
        Map["Leaflet Map Console (CartoDB Tiles)"]
        Speech["Web Speech Synthesis API"]
        LocalPrefs["Local Storage Theme / Accessibility"]
    end

    subgraph EdgeIngest["IoT Edge Ingestion Layer"]
        Hardware["Operational Reefer Sensors (ESP32/Cellular)"]
        Simulator["Lab Telemetry Simulator (/simulator)"]
    end

    subgraph AppServer["Application & API Server (Next.js Turbopack)"]
        Proxy["Edge Security Proxy & Request Correlation (x-request-id)"]
        AuthFilter["HMAC-SHA256 Session Validator (Cookie-based)"]
        PolicyEngine["Unified Authorization Engine (policy.ts)"]
        
        subgraph DomainServices["Domain Service Layer"]
            TelemetrySvc["Telemetry Ingestion & Ordering Service"]
            AlertSvc["Deterministic Alert & Gap Engine"]
            RescueSvc["ACID Rescue Marketplace & Negotiation"]
            AISvc["Advisory Heuristic & Gemini Provider"]
            ImageSvc["Magic-Byte & Image Validation Service"]
            AuditSvc["Append-Only Audit Logging Service"]
        end
    end

    subgraph DataTier["Authoritative Persistence Tier (PostgreSQL 15+)"]
        PG[("PostgreSQL Database")]
        Prisma["Prisma ORM 6.4 (Prepared Queries & Row Locks)"]
        Migrations["Versioned Migrations (schema.prisma)"]
    end

    subgraph ExtCron["External Scheduled Triggers"]
        CronJob["Cron Trigger (Vercel Cron / EventBridge / Worker)"]
    end

    Hardware -->|HTTPS POST + dev_key_...| Proxy
    Simulator -->|Session Authenticated POST| Proxy
    UI <-->|Session Cookie| Proxy
    CronJob -->|POST /api/telemetry/evaluate-gaps + Bearer CRON_SECRET| Proxy

    Proxy --> AuthFilter
    AuthFilter --> PolicyEngine
    PolicyEngine --> DomainServices
    DomainServices --> Prisma
    Prisma --> PG
```

### Core Domain Modules

1. **Authentication & Session Security ([`src/lib/auth`](./src/lib/auth)):** Custom HMAC-SHA256 cryptographic session token generation and verification using `crypto.timingSafeEqual`. Validates expiration timestamps, payload roles, and user identifiers. Fails closed on server boot if `SESSION_SECRET` is shorter than 32 characters in production.
2. **Unified Authorization Policy ([`src/lib/auth/policy.ts`](./src/lib/auth/policy.ts)):** Centralized authorization engine shared by API routes and server views. Evaluates request identity, verified organization membership, system role, and assigned consignment relationships. Enforces selective Prisma projections that strip `passwordHash` and `apiKeyHash`.
3. **Telemetry Ingestion & Ordering ([`src/lib/telemetry`](./src/lib/telemetry)):** Validates incoming JSON payloads against strict numeric bounds. Executes composite sequence deduplication (`@@unique([deviceId, sequence])`). Manages chronological ordering so historical or out-of-order readings cannot roll back a shipment's live status or temperature.
4. **Deterministic Alert Engine ([`src/lib/alerts`](./src/lib/alerts)):** Implements deterministic temperature breach and sensor gap evaluations. Uses a 0.5°C hysteresis recovery margin to prevent rapid oscillation around threshold boundaries.
5. **Transactional Rescue Marketplace ([`src/lib/rescue`](./src/lib/rescue)):** Coordinates emergency cargo transfers. Manages opportunity broadcasting, partner qualification checks, counter-offer proposals, partner responses, and atomic single-winner acceptance using PostgreSQL `SELECT ... FOR UPDATE` row locks.
6. **Cargo Photo Verification ([`src/lib/images`](./src/lib/images)):** Performs server-side inspection of uploaded visual evidence. Validates binary magic bytes, MIME headers, maximum dimensions (4096px), and payload sizes (5 MB) to defend against malicious file uploads.
7. **Append-Only Audit Ledger ([`src/lib/audit`](./src/lib/audit)):** Records every significant operational state change, acknowledgment, negotiation event, and milestone completion with actor metadata, timestamps, and structured JSON context.

### Technology Stack Matrix

| Layer | Technology | Version | Purpose in Annapurna Rebuilt |
| :--- | :--- | :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) | `16.4.3` | App Router, Turbopack compiler, server components, and edge route handlers. |
| **Runtime & Language**| [Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/) | Node `20+` / TS `5.7+` | Type-safe server execution with strict compiler rules (`noImplicitAny`, strict null checks). |
| **Persistence** | [PostgreSQL](https://www.postgresql.org/) & [Prisma](https://www.prisma.io/) | PG `15+` / Prisma `6.4.0` | Relational storage, ACID row locks, foreign key cascades, and migration versioning. |
| **Validation** | [Zod](https://zod.dev/) | `3.24.2` | Runtime boundary validation for all API bodies, query parameters, and IoT sensor payloads. |
| **UI Components** | [React](https://react.dev/) | `19.0.0` | Interactive client views with synchronized console state and optimistic updates. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | `4.0.0` | Semantic slate/emerald/blue styling, responsive layouts, and dark mode class support. |
| **Mapping Engine** | [Leaflet](https://leafletjs.com/) | `1.9.4` | Interactive operational maps rendered using CartoDB Voyager raster tiles. |
| **Cryptography** | Node.js `crypto` & `bcryptjs` | `2.4.3` | Password hashing (salt cost 10), HMAC-SHA256 session tokens, and SHA-256 API key hashing. |
| **Test Runner** | Native Node.js Test Runner | Node `node:test` + `tsx` | Fast, zero-dependency unit and true PostgreSQL concurrency integration test execution. |

---

## Operational Workflows

### 1. Complete Operational Lifecycle

The diagram below traces an active consignment from initial dispatch and normal transit through sensor incident detection, advisory analysis, rescue negotiation, partner handover, and final delivery:

```mermaid
flowchart TD
    Start([Consignment Created]) --> Dispatched["Status: DISPATCHED\nVehicle & Device Assigned"]
    Dispatched --> FirstPacket["First Telemetry Reading Ingested"]
    FirstPacket --> InTransit["Status: IN_TRANSIT\nMonitoring Active Corridor"]
    
    InTransit --> SensorCheck{"Thermal Breach or\nHeartbeat Gap?"}
    SensorCheck -->|No: Compliant Reading| InTransit
    SensorCheck -->|Yes: Breach Detected| AlertTriggered["Status: ALERTED\nActive Alert Generated"]
    
    AlertTriggered --> OperatorAction{"Operator Decision"}
    OperatorAction -->|Reefer Recalibrated / Minor Transient| AckOnly["Alert Acknowledged\nHysteresis Recovery (0.5°C)"]
    AckOnly --> Recovered["Sensor Normalizes\nStatus -> IN_TRANSIT"]
    Recovered --> InTransit
    
    OperatorAction -->|Severe Mechanical Failure| Broadcast["Broadcast Rescue Opportunity\nStatus: OPEN"]
    Broadcast --> Bidding["Partners Submit Capacity Bids & Counter-Offers"]
    Bidding --> AcceptOffer["Operator Accepts Winning Bid\n(SELECT ... FOR UPDATE)"]
    
    AcceptOffer --> Enacted["Opportunity: ACCEPTED\nWinning Offer: ACCEPTED\nCompeting Bids: REJECTED"]
    Enacted --> Handover["Partner Offloading Milestones Recorded\n(TRANSFER_DISPATCHED -> ARRIVED)"]
    Handover --> RescueComplete["Opportunity: COMPLETED\nShipment Status: RESCUED"]
    RescueComplete --> AuditVerification["Final Inspection & Append-Only Audit Log"]
```

### 2. Telemetry Ingestion, Ordering & Deduplication

Ingestion handles high-frequency packets from edge hardware while guaranteeing that out-of-order transmissions, clock drift, or duplicate deliveries cannot corrupt the authoritative shipment state:

```mermaid
flowchart TD
    IngestRequest["POST /api/telemetry/ingest\nJSON Payload: { deviceId, sequence, recordedAt, temp, ... }"] --> AuthToken{"Device Key\nValid SHA-256?"}
    AuthToken -->|No| RejectAuth["401 Unauthorized\nINVALID_DEVICE_KEY"]
    AuthToken -->|Yes| CheckSkew{"Clock Drift\n> 10 min Future?"}
    
    CheckSkew -->|Yes| RejectSkew["400 Bad Request\nFUTURE_TIMESTAMP_REJECTED"]
    CheckSkew -->|No| CheckBounds{"Numeric Bounds\n-60°C to +80°C?"}
    
    CheckBounds -->|No| RejectBounds["400 Bad Request\nSENSOR_VALUE_OUT_OF_BOUNDS"]
    CheckBounds -->|Yes| FindDevice["Find Device in Database\nVerify isSimulated Compatibility"]
    
    FindDevice --> SimCheck{"Device Physical vs\nPacket Simulated?"}
    SimCheck -->|Mismatch: Sim on Op Device| RejectSim["403 Forbidden\nSIMULATION_NOT_PERMITTED"]
    SimCheck -->|Match| TxBlock["Begin PostgreSQL Transaction (Row Lock on Device & Shipment)"]
    
    TxBlock --> CheckDedup{"Unique Constraint\n[deviceId, sequence]"}
    CheckDedup -->|Duplicate P2002| IgnoreDup["Return { status: 'duplicate_ignored',\ndeduplicated: true } (HTTP 200)"]
    
    CheckDedup -->|New Sequence| InsertReading["Insert TelemetryReading Row"]
    InsertReading --> OrderCheck{"recordedAt > latestRecordedAt OR\n(equal timestamp AND seq > latestSeq)?"}
    
    OrderCheck -->|Yes: Newer Reading| UpdateLive["Update Shipment:\nlatestTemperature, latestRecordedAt,\nlatestSequence, coordinates"]
    OrderCheck -->|No: Stale / Historical| SkipLive["Preserve Reading in History Only\n(Do NOT overwrite current status)"]
    
    UpdateLive --> EvalAlerts["Evaluate Alert Rules (Breach / Recovery)"]
    SkipLive --> CommitTx["Commit Transaction"]
    EvalAlerts --> CommitTx
    CommitTx --> IngestSuccess["Return { status: 'accepted' } (HTTP 200)"]
```

### 3. Alert Lifecycle, Hysteresis & Sensor Recovery

The alert state machine prevents false-positive flapping through explicit threshold hysteresis and ties shipment health to active incident counts:

```mermaid
stateDiagram-v2
    [*] --> OK : Shipment in DISPATCHED / IN_TRANSIT
    
    OK --> ACTIVE : Temperature Breach (> Max + Buffer)\nOR Heartbeat Stalled (> Grace Window)
    note right of ACTIVE
      Shipment status moves to ALERTED.
      Rule codes: TEMP_HIGH_BREACH,
      TEMP_LOW_BREACH, MISSING_TELEMETRY.
    end note
    
    ACTIVE --> ACKNOWLEDGED : Operator reviews incident\nand submits acknowledgment notes
    note right of ACKNOWLEDGED
      Shipment remains in ALERTED.
      Prevents duplicate alerts from re-triggering.
    end note
    
    ACKNOWLEDGED --> RESOLVED : Fresh compliant telemetry arrives\nwithin hysteresis margin (0.5°C)\nOR Manual resolution with override reason
    ACTIVE --> RESOLVED : Operational reading restores heartbeat\n(auto-resolves MISSING_TELEMETRY)
    
    RESOLVED --> OK : If zero remaining ACTIVE or ACKNOWLEDGED\nalerts exist on shipment
    note right of OK
      Shipment status safely restores to IN_TRANSIT.
      Terminal states (DELIVERED, RESCUED) never revert.
    end note
```

### 4. Rescue Bidding, Counter-Offer Negotiation & Atomic Acceptance

Rescue opportunities guarantee transactional integrity through PostgreSQL row locks, preventing concurrent acceptance race conditions between competing storage partners:

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Fleet Operator
    participant API as Rescue Service (Prisma)
    participant DB as PostgreSQL (ACID)
    actor PartnerA as Partner A (Sahyadri Cold)
    actor PartnerB as Partner B (Coastal Storage)

    Operator->>API: Broadcast Opportunity (Shipment #104, Target 2-6°C, Budget ₹25,000)
    API->>DB: INSERT RescueOpportunity (status: OPEN)
    
    PartnerA->>API: Submit Offer A (₹22,000, ETA 30m, 5000 kg)
    API->>DB: INSERT RescueOffer (status: SUBMITTED)
    
    PartnerB->>API: Submit Offer B (₹24,000, ETA 20m, 3000 kg)
    API->>DB: INSERT RescueOffer (status: SUBMITTED)
    
    Operator->>API: Counter-Offer to Partner A (₹19,500, "Match regional rate")
    API->>DB: UPDATE Offer A (status: COUNTERED, counterAmount: 19500)
    
    PartnerA->>API: Partner A Accepts Counter
    API->>DB: UPDATE Offer A (isPartnerApproved: true, offerAmount: 19500)
    
    rect rgb(240, 253, 244)
    Note over Operator,DB: Atomic Acceptance (SELECT ... FOR UPDATE)
    Operator->>API: Accept Offer A
    API->>DB: SELECT "id" FROM "RescueOpportunity" WHERE id = #104 FOR UPDATE
    API->>DB: UPDATE RescueOffer A SET status = 'ACCEPTED'
    API->>DB: UPDATE RescueOffer B SET status = 'REJECTED' (Atomic rejection)
    API->>DB: UPDATE RescueOpportunity SET status = 'ACCEPTED', acceptedOfferId = Offer A
    end
    
    API-->>Operator: 200 OK (Contract Enacted)
    API-->>PartnerA: Notification (Offer Accepted)
    API-->>PartnerB: Notification (Offer Rejected)
    
    PartnerA->>API: Record Milestone (TRANSFER_DISPATCHED)
    PartnerA->>API: Record Milestone (CARGO_OFFLOADED)
    Operator->>API: Complete Rescue (Verification Notes)
    API->>DB: UPDATE RescueOpportunity (status: COMPLETED)
    API->>DB: UPDATE Shipment (status: RESCUED)
```

### 5. Shared Authorization & Multi-Tenant Boundaries

A single unified policy engine ([`src/lib/auth/policy.ts`](./src/lib/auth/policy.ts)) enforces access control across all API routes, server actions, and server-rendered Next.js pages:

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> CookieCheck{"annapurna_session\nCookie Present?"}
    CookieCheck -->|No| PublicRoute{"Public Endpoint?\n(/login, /tracking, /features)"}
    PublicRoute -->|Yes| AllowPublic["Allow Public Projection (Sanitized)"]
    PublicRoute -->|No| DenyAuth["401 Unauthorized\nRedirect to /login"]
    
    CookieCheck -->|Yes| VerifyToken["Verify HMAC-SHA256 Token Signature\nCheck Expiration Timestamp"]
    VerifyToken -->|Signature Tampered / Expired| DenyInvalid["401 Unauthorized\nClear Cookie"]
    VerifyToken -->|Valid| LoadActor["Load Actor Context (userId, role, organizationId)"]
    
    LoadActor --> RouteType{"Requested Resource Type"}
    
    RouteType -->|Shipment / Consignment| CheckShipment["Evaluate authorizeShipmentAccess()"]
    CheckShipment --> AdminCheck{"User Role == ADMIN?"}
    AdminCheck -->|Yes| AuditReadOnly["Allow READ_AUDIT (Deny mutations without org membership)"]
    AdminCheck -->|No| OrgMember{"User Member of\nShipment Org?"}
    
    OrgMember -->|Yes| DriverCheck{"User Role == DRIVER?"}
    DriverCheck -->|Yes: Assigned Driver| AllowDriver["Allow Access (Assigned Shipment Only)"]
    DriverCheck -->|Yes: Unassigned Driver| DenyDriver["403 Forbidden\nDRIVER_NOT_ASSIGNED"]
    DriverCheck -->|No: Operator / Manager| AllowOperator["Allow Full Operational Management"]
    
    OrgMember -->|No| WinningPartner{"User Member of Winning\nRescue Partner Org?"}
    WinningPartner -->|Yes| AllowPartnerRescue["Allow Handover Access & Milestones"]
    WinningPartner -->|No| DenyTenant["403 Forbidden\nORG_ACCESS_DENIED"]
    
    RouteType -->|Rescue Opportunity| CheckRescue["Evaluate Rescue Scoping"]
    CheckRescue --> PartnerBidRule["Partners see Open Opps; Competitor Bids Strictly Redacted"]
```

### 6. Missing-Heartbeat Detection & Distributed Cursor Scanning

The missing-heartbeat scanner detects communication blackouts without locking the entire database or suffering from scan overlap:

```mermaid
flowchart TD
    Trigger["POST /api/telemetry/evaluate-gaps"] --> AuthCheck{"Authorization:\nBearer CRON_SECRET\nOR Operator Session?"}
    AuthCheck -->|Unauthorized| DenyCron["401 Unauthorized"]
    AuthCheck -->|Authorized| LockCursor["Acquire Distributed Scan Lease in DB\n(TelemetryScanCursor: lockedUntil = now + 60s)"]
    
    LockCursor --> CursorActive{"Lease Successfully\nAcquired?"}
    CursorActive -->|No: Scan In Progress Elsewhere| SkipScan["Return { skipped: true, reason: 'LOCKED' }"]
    
    CursorActive -->|Yes| QueryShipments["Query Batch of Active Shipments\n(status: IN_TRANSIT, deviceId != null)\nCursor: id > lastShipmentId ORDER BY id ASC LIMIT 50"]
    
    QueryShipments --> ForEachShipment["For Each Shipment in Batch"]
    ForEachShipment --> CheckSim{"Assigned Device\nisSimulated == true?"}
    CheckSim -->|Yes| SkipSim["Skip (Simulated devices excluded from live gap scanner)"]
    
    CheckSim -->|No: Operational Device| CalcGap{"Time Elapsed Since\nlatestRecordedAt > Window (15m)\nOR (never reported AND created > 30m)?"}
    
    CalcGap -->|No: Telemetry Fresh| SkipHealthy["Shipment Nominal"]
    CalcGap -->|Yes: Heartbeat Stalled| DupAlertCheck{"Active MISSING_TELEMETRY\nAlert Already Open?"}
    
    DupAlertCheck -->|Yes| SkipDupAlert["Avoid Duplicate Incident"]
    DupAlertCheck -->|No| GenerateAlert["Create Alert (ruleCode: MISSING_TELEMETRY)\nUpdate Shipment Status -> ALERTED\nRecord Audit Event"]
    
    GenerateAlert --> NextShipment["Next in Batch"]
    SkipHealthy --> NextShipment
    SkipSim --> NextShipment
    SkipDupAlert --> NextShipment
    
    NextShipment --> BatchComplete{"Batch Finished?"}
    BatchComplete -->|Yes| ReleaseLease["Release Scan Lease\nUpdate lastShipmentId & lastScanCompletedAt"]
    ReleaseLease --> ReturnStats["Return { success: true, shipmentsEvaluated, alertsCreated }"]
```

### 7. Advisory Incident Intelligence & Speech Flow

When an incident occurs, operators can invoke heuristic decision support to assess warming trends, generate structured mitigation drafts, and play audio transcripts:

```mermaid
flowchart TD
    OpClick["Operator Clicks 'Analyze Incident'\n(Selects Target Language & Enters Question)"] --> BudgetCheck{"Request Budget OK?\n(Max 20 req / shipment / hr)"}
    BudgetCheck -->|Limit Exceeded| RejectBudget["429 Too Many Requests\nHOURLY_BUDGET_EXCEEDED"]
    
    BudgetCheck -->|Within Budget| ComputeGradient["Calculate Deterministic Metrics:\nWarming Velocity (+°C/10 min), Time to Breach"]
    
    ComputeGradient --> ProviderCheck{"GEMINI_API_KEY Configured\n& Provider Online?"}
    ProviderCheck -->|Yes| CallGemini["Invoke Gemini API (Structured JSON Schema,\nLanguage Translation, 5s Strict Timeout)"]
    ProviderCheck -->|No / Timeout / Error| FallbackExpert["Fallback to Deterministic Heuristic Engine\n(Pre-compiled rule matrices based on cargo type)"]
    
    CallGemini --> ParseOutput["Validate Output Schema via Zod"]
    FallbackExpert --> ParseOutput
    
    ParseOutput --> PersistAssessment["Save IncidentAssessment Record in DB\n(riskLevel, warmingVelocity, suggestedActions, draftUpdate)"]
    
    PersistAssessment --> ClientRender["Shipment Detail Drawer Displays Advice & Driver Draft"]
    ClientRender --> SpeechAction{"User Clicks\nSpeech Synthesizer?"}
    SpeechAction -->|Yes| WebSpeech["Browser Web Speech API Synthesizes Audio\n(Volume2 / VolumeX controls with typed fallback)"]
    SpeechAction -->|No| ReadOnly["Operator Reviews Guidance on Screen"]
```

### 8. Developer Verification & Pipeline Flow

The sequence below illustrates the reproducible local setup, migration, invariant testing, and build verification path:

```mermaid
flowchart TD
    Setup["1. Environment Preparation\ncp .env.example .env\nSet DATABASE_URL & SESSION_SECRET"] --> Deps["2. Dependency Installation\nnpm install (strict package-lock.json)"]
    Deps --> Migrate["3. Apply Schema Migrations\nnpm run db:migrate (Prisma deploy)"]
    Migrate --> GenClient["4. Generate Typed Client\nnpm run db:generate"]
    GenClient --> SeedData["5. Non-Destructive Init\nnpm run db:init-essential"]
    
    SeedData --> QualityChecks{"Quality & Invariant Verification"}
    QualityChecks --> TypeCheck["Type Check: npx tsc --noEmit"]
    QualityChecks --> LintCheck["Code Style: npm run lint"]
    QualityChecks --> UnitIntTests["Automated Tests: npm test\n(49 unit, integration & row-lock concurrency tests)"]
    QualityChecks --> BrowserTests["Browser Journey: npm run test:browser\n(Automated headless Chromium via CDP)"]
    
    TypeCheck --> Build["6. Production Build\nnpm run build (Next.js Turbopack)"]
    LintCheck --> Build
    UnitIntTests --> Build
    BrowserTests --> Build
    
    Build --> Probes["7. Runtime Probes\nGET /api/health -> 200 { status: 'ok' }\nGET /api/ready -> 200 { status: 'ready' }"]
```

---

## Engineering Decisions & Defensive Invariants

The table below outlines key engineering trade-offs and structural safeguards implemented across the codebase:

| Challenge | Implemented Defensive Mechanism | What It Protects | Remaining Scope & Limits |
| :--- | :--- | :--- | :--- |
| **Cross-Tenant Data Exposure** | Unified authorization policy in [`policy.ts`](./src/lib/auth/policy.ts) evaluated on all routes and server components. | Prevents Fleet A from querying Fleet B's routes, devices, alerts, or bids. | Requires developers to route all future queries through `policy.ts` helpers. |
| **Credential Hash Leakage** | Explicit Prisma `select` projections that strictly omit `passwordHash` and `apiKeyHash`. | Ensures raw password hashes and device secrets are never serialized into client component props or JSON responses. | Does not protect against malicious database administrators with direct SQL query access. |
| **Concurrent Rescue Acceptance** | PostgreSQL row-level locks via `SELECT ... FOR UPDATE` inside `prisma.$transaction`. | Prevents race conditions where two competing partner offers are accepted simultaneously. | Serialization introduces brief row locking; requires database connection pool sizing. |
| **Out-of-Order Telemetry** | Monotonic ordering check comparing `recordedAt` and sequence numbers against live shipment state. | Stale or delayed packets stored in historical time series without reverting active coordinates or status. | Packets with corrupted hardware timestamps (> 10m future drift) are rejected entirely. |
| **Duplicate Telemetry Replays** | Composite unique database constraint `@@unique([deviceId, sequence])` with idempotent P2002 handling. | Network retries and duplicate transmissions are ignored without creating duplicate database rows or alerts. | Requires edge firmware to monotonically increment integer sequence numbers. |
| **Accidental Database Resets** | Strict host and database name parser in [`db_safety.ts`](./src/lib/db-safety.ts) (`assertSafeForDestructiveReset`). | Immediately aborts demo reset scripts if connection strings target cloud providers (AWS, Neon, Supabase). | Local disposable test databases (`annapurna_dev`, `annapurna_test`) can still be cleared with explicit flags. |
| **Terminal State Preservation** | State machine guard rejecting transitions on `DELIVERED`, `CANCELLED`, or `RESCUED` shipments. | Prevents late sensor packets or gap scanners from re-opening closed incidents or concluded shipments. | Does not permit retroactive administrative corrections without direct database intervention. |
| **Simulation Hardware Isolation** | Physical devices flagged with `isSimulated: false` by default; simulation scenarios blocked on real hardware. | Prevents synthetic lab stress-tests from corrupting real operational vehicle telemetry. | Synthetic simulator requires manual activation via `ENABLE_SIMULATOR=true`. |
| **Silent Heartbeat Dropouts** | Distributed cursor scanner with lease locks (`lockedUntil`) and pagination. | Detects communication blackouts without holding prolonged table locks or overlapping cron runs. | Requires external cron infrastructure to trigger `/api/telemetry/evaluate-gaps` periodically. |
| **Cargo Photo Integrity** | Server-side validation of file magic bytes, MIME types, pixel dimensions, and byte lengths. | Rejects disguised executable payloads, oversized buffers, and SVG script injection attacks. | Stored on local filesystem relative to root; serverless deployments require object storage. |
| **AI Availability Dependencies** | Deterministic expert system heuristic fallback wrapped around external LLM calls with 5s timeouts. | Ensures thermal velocity calculation and incident action plans render even if external AI APIs fail. | Fallback advice uses static pre-compiled rule matrices rather than generative language models. |

---

## Role-Oriented User Journeys

### 1. Fleet Operator
- **Primary Workspaces:** `/fleet`, `/shipments`, `/alerts`, `/rescue`, `/analytics`.
- **Workflow:** Operators monitor the map-centered fleet console, inspect consignment temperature graphs, filter by risk level, acknowledge triggered alerts, and broadcast rescue opportunities when reefer mechanical failure is confirmed.
- **First Action to Try:** Navigate to `/fleet`, select an active consignment from the list, observe the synchronized map highlight and route polyline, and inspect the right-hand health panel.

### 2. Reefer Driver
- **Primary Workspace:** `/driver`.
- **Workflow:** Drivers access a focused mobile-optimized view displaying their assigned vehicle, cargo target temperature band (e.g. 2.0°C to 6.0°C), live sensor reading, and delivery destination.
- **First Action to Try:** Log in with driver credentials; verify that only the single consignment assigned to the driver is accessible, while all other fleet consignments are strictly denied.

### 3. Rescue Cold-Storage Partner
- **Primary Workspaces:** `/rescue`, `/bidding`.
- **Workflow:** Regional cold-storage facility directors complete facility onboarding, inspect broadcast rescue requests within their operational radius, submit capacity quotes, negotiate counter-offers, and log offloading milestones upon cargo arrival.
- **First Action to Try:** Navigate to `/rescue`, open an active rescue opportunity, inspect the temperature requirement, and submit a competitive capacity bid.

### 4. Platform Administrator
- **Primary Workspaces:** `/admin`, `/audit`, `/org`.
- **Workflow:** System administrators audit platform governance, review cross-tenant access attempts, inspect the append-only operational event ledger, and provision organization memberships.
- **Security Limitation:** Platform administrators operate under read-only audit mode for fleet operations; they cannot create consignments or modify vehicle assignments without active membership in that fleet organization.

---

## Quickstart & Setup Guide

### Prerequisites
- **Node.js:** `v20.x` or `v22.x` (LTS recommended)
- **PostgreSQL:** `15+` or `16+` instance (Local or hosted on Neon, Supabase, AWS RDS)
- **Package Manager:** `npm v10+`

### 1. Clone & Configure Environment
```bash
git clone https://github.com/Kenkei69/Annapurna-Rebuilt.git
cd Annapurna-Rebuilt
cp .env.example .env
```

Open `.env` and verify your database connection string and session secret:
```ini
DATABASE_URL="postgresql://postgres:password@localhost:5432/annapurna_db?sslmode=disable"
SESSION_SECRET="your_secure_random_hmac_secret_at_least_32_chars_long"
NODE_ENV="development"
ENABLE_SIMULATOR="true"
```

### 2. Install Dependencies & Deploy Database Schema
```bash
npm install
npm run db:migrate
npm run db:generate
```

### 3. Initialize Authoritative Database Structures
To initialize administrative structures and system roles non-destructively:
```bash
npm run db:init-essential
```

For isolated local development with pre-configured demo personas:
```bash
npm run db:seed
```

> **Warning on Destructive Operations:** The script `npm run db:reset-demo` completely erases operational data and is strictly blocked by `assertSafeForDestructiveReset` if pointing to any database with production indicators. Never execute reset commands against production databases.

### 4. Launch the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

<details>
<summary><strong>Advanced Configuration & Pre-Seeded Personas</strong></summary>

#### Complete Environment Variable Reference
| Variable | Description | Required | Default / Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URL | **Yes** | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | 32+ char secret for HMAC cookie signing | **Yes** | Use `openssl rand -hex 32` |
| `NODE_ENV` | Application runtime environment | No | `development` / `production` |
| `ENABLE_SIMULATOR` | Enables the `/simulator` testing route | No | `false` in production, `true` in dev |
| `CRON_SECRET` | Bearer token for missing-heartbeat endpoint | Optional | Secret string passed in Authorization header |
| `GEMINI_API_KEY` | Google Gemini API key for incident advice | Optional | Falls back to expert rule engine if unset |

#### Pre-Configured Development Seed Personas
When `npm run db:seed` is executed, the following personas are provisioned for local testing:
- **Fleet Operator:** `operator@transcold.com` (TransCold Express Logistics)
- **Reefer Driver:** `driver.raj@transcold.com` (TransCold Express Logistics)
- **Rescue Partner:** `director@sahyadricold.com` (Sahyadri Agro Cold Storage)
- **Platform Admin:** `admin@annapurna.local` (System Governance)
- **Competitor Operator:** `operator@coastalreefer.com` (Coastal Reefer Lines - for tenant isolation checks)

#### Production Admin Provisioning Command
To provision a production administrator under strict credential policies (minimum 12 characters with mixed complexity):
```bash
ADMIN_EMAIL="admin@yourdomain.com" ADMIN_PASSWORD="YourStrongPassword123!" npm run db:provision-admin
```

</details>

---

## Verification & Evidence

### Test Suite Execution
To execute all 49 unit and integration test assertions:
```bash
npm test
```

### Verified Test Inventory (49 / 49 Passing on Head Commit):
- **Credential Protection & Advanced Workflows (5 tests):** Verified in [`tests/integration/cargo_photos_and_counter_offers.test.ts`](./tests/integration/cargo_photos_and_counter_offers.test.ts). Tests `apiKeyHash` omission, cargo weight persistence, private photo access isolation, counter-offer negotiation, and advisory query budgets.
- **Core Endpoints, Lifecycle & Gaps (6 tests):** Verified in [`tests/integration/core_workflows_and_endpoints.test.ts`](./tests/integration/core_workflows_and_endpoints.test.ts). Tests `/api/health` liveness, `/api/ready` database dependency probe, device status transitions, heartbeat gap detection, and organization settings.
- **Partner Onboarding (1 test):** Verified in [`tests/integration/partner_onboarding.test.ts`](./tests/integration/partner_onboarding.test.ts). Tests onboarding profile completion and bid qualification invariants.
- **Cargo Rescue Concurrency (3 tests):** Verified in [`tests/integration/rescue_concurrency.test.ts`](./tests/integration/rescue_concurrency.test.ts). Tests concurrent acceptance race conditions, single-winner mutual exclusion, and idempotent re-acceptance.
- **Rescue Lifecycle & Suitability (1 test):** Verified in [`tests/integration/rescue_lifecycle.test.ts`](./tests/integration/rescue_lifecycle.test.ts). Tests suitability validation, expiry persistence, and atomic rescue completion.
- **Tenant Isolation & Security Policies (1 test):** Verified in [`tests/integration/shipment_authorization.test.ts`](./tests/integration/shipment_authorization.test.ts). Tests isolation boundaries across competitors, unassigned drivers, and unrelated partners.
- **Telemetry Ingestion & Simulation Isolation (1 test):** Verified in [`tests/integration/telemetry_ingestion_and_simulation.test.ts`](./tests/integration/telemetry_ingestion_and_simulation.test.ts). Tests sequence deduplication, out-of-order packet safety, and operational hardware isolation.
- **End-to-End Operational Journey (1 test):** Verified in [`tests/integration/workflow.test.ts`](./tests/integration/workflow.test.ts). Complete journey from operator dispatch through telemetry, alert, rescue offer, milestones, and audit verification.
- **Unit Domain Modules (30 tests):** Tests state machine transitions, AI heuristic warming calculation, password hashing, session cryptography, token tampering rejection, database safety guards, device key authentication, telemetry schema boundary validation, and clock drift rejection.

### Automated Browser Journey Verification
The compiled application is tested end-to-end using headless Chromium via Chrome DevTools Protocol (CDP):
```bash
npm run test:browser
```
**Verified Flows:** Operator authentication via `POST /api/auth/login`, Leaflet DOM map container rendering on `/fleet`, rescue opportunity and counter-offer listings on `/rescue`, ESG carbon offset models on `/analytics`, dark-mode class persistence on `/org`, and unauthenticated access on `/tracking`.

---

## Documentation Index

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): System architecture, unified authorization policies, and domain service boundaries.
- [`DATA_MODEL.md`](./DATA_MODEL.md): Relational schema, entity relationships, database indexes, and state machine transitions.
- [`SETUP.md`](./SETUP.md): Step-by-step local development setup, prerequisites, and environment configuration.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md): Deployment instructions, migration procedures, and zero-downtime rollback strategy.
- [`TESTING.md`](./TESTING.md): Verification matrix, test inventory, and browser journey documentation.
- [`SECURITY.md`](./SECURITY.md): Threat model, credential hashing, session cryptography, and access policies.
- [`SIMULATOR.md`](./SIMULATOR.md): Ingestion contract, payload schemas, and synthetic scenario test harness.
- [`PROVENANCE.md`](./PROVENANCE.md): Authorship declaration, origin history, and licensing decision context.
- [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md): Dependency license disclosures.
- [`LICENSING_DECISION.md`](./LICENSING_DECISION.md): Analysis of third-party obligations and licensing options for the maintainer.

---

## Authorship, Provenance & Licensing

- **Author & Maintainer:** Kenkei69
- **Implementation Mechanism:** Developed by Kenkei69 with AI assistance (Advanced Agentic Pair-Programming).
- **Provenance Statement:** Annapurna Rebuilt is an original reimplementation designed from cold-chain product requirements. The historical repository (`Kenkei69/Annapurna`) and its complete commit history remain preserved untouched. See [`PROVENANCE.md`](./PROVENANCE.md) for full historical context.
- **Licensing Notice:** An open-source license has not been unilaterally attached on the maintainer's behalf. As documented in [`LICENSING_DECISION.md`](./LICENSING_DECISION.md), license selection is reserved exclusively for the maintainer. All underlying third-party dependencies are permissively licensed (MIT, Apache-2.0, ISC).
