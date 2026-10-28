# Annapurna Rebuilt — Edge IoT Firmware Documentation

This directory contains reference firmware for ESP32-based refrigerated transport nodes communicating with the **Annapurna Rebuilt** cold-chain ingestion endpoint.

---

## 1. Hardware Architecture

- **Microcontroller:** ESP32 (Dual Core 240MHz, Wi-Fi 802.11 b/g/n, BLE 4.2).
- **Sensors:** SHT31, DHT22, or DS18B20 digital temperature probe; optional NEO-6M / NEO-M8N GPS module.
- **Power:** 3.7V Li-ion battery with solar / vehicle alternator recharge via TP4056 or LTC4079.
- **Local Storage:** ESP32 Non-Volatile Storage (NVS) for monotonic sequence counter preservation across reboots.

---

## 2. Ingestion Protocol Contract

- **Endpoint:** `POST /api/telemetry/ingest`
- **Authentication:** `X-Device-Key: <PROVISIONED_API_KEY>`
- **Content-Type:** `application/json`

### Payload Schema:
```json
{
  "deviceId": "DEVICE-APN-001",
  "sequence": 142,
  "recordedAt": "2026-10-28T10:15:00.000Z",
  "temperature": 4.2,
  "humidity": 68.5,
  "latitude": 19.0760,
  "longitude": 72.8777,
  "batteryPct": 92,
  "isSimulated": false
}
```

---

## 3. Security & Anti-Replay Mechanism

1. **Per-Device Key Authentication:**
   - Keys are provisioned in the Annapurna platform via `POST /api/devices`.
   - The platform generates a high-entropy secret (`dev_key_...`), returns it **once** to the operator, and stores only its **SHA-256 hash** in PostgreSQL.
   - The device includes the raw key in the `X-Device-Key` header over TLS.
2. **Monotonic Sequence Enforcement:**
   - The device increments `sequence` on every successful transmission and stores it in NVS.
   - If an attacker or network glitch retransmits an older sequence, the server rejects it with HTTP 409 (`DUPLICATE_SEQUENCE`), preventing replay attacks and duplicate alert triggers.
3. **Clock Skew Protection:**
   - The gateway rejects readings with timestamps skewed more than 10 minutes into the future to protect against misconfigured NTP or rogue packets.

---

## 4. Flashing Instructions

1. Install Arduino IDE or PlatformIO.
2. Install the ESP32 board support package (version >= 2.0.14).
3. Open `esp32_annapurna_sensor/esp32_annapurna_sensor.ino`.
4. Replace `WIFI_SSID`, `WIFI_PASSWORD`, `INGEST_URL`, `DEVICE_ID`, and `DEVICE_KEY` with your credentials obtained from the **Edge Devices** page in Annapurna Rebuilt.
5. Compile and upload at 115200 baud.
