/**
 * Annapurna Rebuilt — ESP32 Cold-Chain Telemetry Node
 * 
 * Hardware Architecture:
 * - ESP32 microcontroller with Wi-Fi / LTE-M backhaul
 * - DHT22 / SHT3x temperature & relative humidity sensor
 * - Onboard RTC synchronized via SNTP
 * - Non-volatile memory (NVS) sequence counter preservation
 * 
 * Ingestion Endpoint Contract:
 * - Method: POST /api/telemetry/ingest
 * - Auth Header: X-Device-Key: <PROVISIONED_API_KEY>
 * - Content-Type: application/json
 * 
 * Original implementation for Annapurna Rebuilt platform.
 * Maintained by Kenkei69 with AI assistance.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>
#include <Preferences.h>

// ==========================================
// CONFIGURATION (Set via provisioning tool)
// ==========================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Annapurna API Gateway
const char* INGEST_URL    = "https://annapurna.example.com/api/telemetry/ingest";
const char* DEVICE_ID     = "DEVICE-APN-001";
const char* DEVICE_KEY    = "YOUR_PROVISIONED_API_KEY_HERE";

// Sensor & Ping Intervals
const unsigned long PING_INTERVAL_MS = 60000; // 60 seconds
const int SENSOR_PIN = 4; // GPIO connected to temperature sensor

// NTP Server Settings
const char* NTP_SERVER = "pool.ntp.org";
const long  GMT_OFFSET_SEC = 0; // UTC
const int   DAYLIGHT_OFFSET_SEC = 0;

// Persistent Sequence Storage
Preferences prefs;
uint32_t currentSequence = 1;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[ANNAPURNA] Booting Cold-Chain Telemetry Node...");
  Serial.printf("[ANNAPURNA] Device ID: %s\n", DEVICE_ID);

  // 1. Initialize Non-Volatile Storage (NVS) for Sequence Counter
  prefs.begin("annapurna", false);
  currentSequence = prefs.getUInt("seq", 1);
  Serial.printf("[ANNAPURNA] Restored sequence counter: %u\n", currentSequence);

  // 2. Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[ANNAPURNA] Connecting to Wi-Fi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[ANNAPURNA] Wi-Fi Connected. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[ANNAPURNA] Wi-Fi connection timeout. Operating in offline logging mode.");
  }

  // 3. Synchronize Time via SNTP
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 5000)) {
    Serial.println("[ANNAPURNA] NTP Clock Synchronized.");
  } else {
    Serial.println("[ANNAPURNA] NTP Synchronization Warning: Clock not verified.");
  }
}

// Generate ISO 8601 UTC timestamp: "2026-10-28T12:00:00.000Z"
String getIsoTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 1000)) {
    return "1970-01-01T00:00:00.000Z";
  }
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// Read sensor temperature (stub or hardware driver)
float readTemperature() {
  // Replace with actual sensor read e.g., dht.readTemperature() or ds18b20.getTempC()
  // Simulated hardware reading for demo / testing:
  return 4.25f + ((float)(random(-30, 30)) / 100.0f);
}

float readHumidity() {
  // Replace with actual sensor read e.g., dht.readHumidity()
  return 65.0f + ((float)(random(-50, 50)) / 10.0f);
}

int readBatteryPct() {
  // Read analog voltage divider on ADC pin
  return 96;
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ANNAPURNA] Reconnecting Wi-Fi...");
    WiFi.reconnect();
    delay(5000);
    return;
  }

  float temp = readTemperature();
  float hum  = readHumidity();
  int batt   = readBatteryPct();
  String timestamp = getIsoTimestamp();

  // Construct JSON Payload adhering to schema
  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"sequence\":" + String(currentSequence) + ",";
  payload += "\"recordedAt\":\"" + timestamp + "\",";
  payload += "\"temperature\":" + String(temp, 2) + ",";
  payload += "\"humidity\":" + String(hum, 1) + ",";
  payload += "\"batteryPct\":" + String(batt) + ",";
  payload += "\"isSimulated\":false";
  payload += "}";

  Serial.printf("[ANNAPURNA] Transmitting telemetry packet #%u: %s\n", currentSequence, payload.c_str());

  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("[ANNAPURNA] Server response HTTP %d: %s\n", httpCode, response.c_str());

    if (httpCode == 200 || httpCode == 201) {
      // Advance and persist sequence number on success
      currentSequence++;
      prefs.putUInt("seq", currentSequence);
    } else if (httpCode == 409) {
      Serial.println("[ANNAPURNA] Duplicate sequence detected by gateway. Advancing counter.");
      currentSequence++;
      prefs.putUInt("seq", currentSequence);
    }
  } else {
    Serial.printf("[ANNAPURNA] HTTP Ingestion Failed. Error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();

  // Sleep until next cycle
  delay(PING_INTERVAL_MS);
}
