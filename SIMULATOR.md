# Annapurna Rebuilt — Synthetic Telemetry Simulator Guide

## Purpose & Scope
Annapurna Rebuilt includes a built-in, clearly labeled **Synthetic Telemetry Simulator** (`/simulator`). The simulator enables operators and reviewers to verify real-time cold-chain monitoring, deterministic alert generation, deduplication, and cargo rescue workflows without physical hardware attached.

> [!IMPORTANT]
> **Simulated vs Real Demarcation:**
> Every reading emitted by this simulator is tagged with `isSimulated: true`. The database, APIs, and UI explicitly flag simulated packets to ensure total operational transparency.

---

## Ingestion Contract
Real and simulated devices both transmit readings to the same hardened endpoint:
- **HTTP Method:** `POST`
- **Endpoint:** `/api/telemetry/ingest`
- **Authentication:** `Authorization: Bearer <plainDeviceApiKey>`

### Request Body Schema:
```json
{
  "deviceId": "DEVICE-APN-001",
  "sequence": 142,
  "recordedAt": "2026-10-28T10:14:00.000Z",
  "temperature": 3.8,
  "humidity": 65.0,
  "latitude": 19.076,
  "longitude": 72.877,
  "batteryPct": 94.0,
  "isSimulated": true
}
```

---

## Built-In Scenarios

The simulator provides 5 automated scenarios accessible from the Web UI (`/simulator`) or the programmatic API (`POST /api/simulator/run`):

### 1. `NORMAL` (Safe In-Transit Operation)
- **Behavior:** Injects 3 sequential readings comfortably within the configured cargo thresholds (e.g. 2.5°C, 3.0°C, 2.8°C).
- **Expected Outcome:** Telemetry timeline updates. Shipment automatically transitions from `DISPATCHED` to `IN_TRANSIT`. Zero alerts triggered.

### 2. `GRADUAL_WARMING` (Compressor Mechanical Failure)
- **Behavior:** Injects 4 consecutive readings with rising temperatures (+4.1°C above threshold limit).
- **Expected Outcome:** Triggers the deterministic `SUSTAINED_BREACH` alert rule. Alert severity elevated to `CRITICAL`. Shipment status transitions to `ALERTED`. Operator receives immediate notification to inspect or rescue.

### 3. `DOOR_AJAR` (Thermal Shock / Unsealed Bay)
- **Behavior:** Injects rapid thermal spike (+6.0°C jump) accompanied by 95% relative humidity.
- **Expected Outcome:** Triggers high temperature and humidity alert rules simultaneously.

### 4. `SENSOR_OFFLINE` (Stale / Delayed Telemetry)
- **Behavior:** Injects a reading with a timestamp backdated 45 minutes in the past.
- **Expected Outcome:** Simulates cellular drop-off. Shipment detail page displays the **Stale Telemetry Warning** (`> 30 min delay`).

### 5. `REPLAY_DUPLICATE` (Network Retry Idempotency)
- **Behavior:** Transmits a packet containing an already-processed `(deviceId, sequence)` pair.
- **Expected Outcome:** PostgreSQL unique constraint prevents duplicate row insertion. Response returns `{ status: "duplicate_ignored", deduplicated: true }`. Zero alert evaluations or side effects occur.

---

## Programmatic Simulator Execution
To run a simulation scenario via `curl`:
```bash
curl -X POST http://localhost:3000/api/simulator/run \
  -H "Content-Type: application/json" \
  -H "Cookie: annapurna_session=<sessionToken>" \
  -d '{
    "deviceId": "DEVICE-APN-001",
    "scenario": "GRADUAL_WARMING"
  }'
```
