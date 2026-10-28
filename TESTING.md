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

### Verified Test Suites (16 / 16 Passing):
```
✔ Integration Workflow: Complete End-to-End Operator -> Telemetry -> Alert -> Rescue Journey
✔ Shipment State Machine - Enforces valid transitions
✔ AI Heuristic Engine - Correctly computes warming gradient and action plan
✔ Auth Module - Password hashing and verification
✔ Auth Module - Session Token creation and valid verification
✔ Auth Module - Tampered token signature is rejected
✔ Auth Module - Expired token is rejected
✔ Cargo Rescue Concurrency - Single accepted offer guarantees mutual exclusion
✔ Device Authentication - Accepts valid provisioned API key
✔ Device Authentication - Rejects invalid or mismatched API key
✔ Device Authentication - Rejects non-existent device identifier
✔ Telemetry Module - Valid telemetry payload passes schema
✔ Telemetry Module - Out-of-bounds temperature is rejected
✔ Telemetry Module - Device API key hashing is deterministic SHA-256
✔ Telemetry Edge Cases - Future timestamps (> 10m drift) are rejected
✔ Telemetry Edge Cases - Sequence deduplication prevents duplicate row creation

ℹ tests 16
ℹ pass 16
ℹ fail 0
```

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
