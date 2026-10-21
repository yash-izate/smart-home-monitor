#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

// ==================== PIN CONFIGURATION ====================
#define DHT_PIN         4
#define DHT_TYPE        DHT11
#define FLAME_PIN       5
#define LDR_PIN         6
#define VIBRATION_PIN   7
#define GREEN_LED       16
#define YELLOW_LED      17
#define RED_LED         18
#define OLED_SDA        8
#define OLED_SCL        9

// ==================== WI-FI CONFIGURATION ====================
const char* WIFI_SSID = "Moto101";
const char* WIFI_PASSWORD = "223334444";

// ==================== AUTOMATION SETTINGS ====================
const int LIGHT_THRESHOLD = 2700;
const float AC_ON_TEMP = 30.0;
const float AC_OFF_TEMP = 27.0;
const unsigned long VIBRATION_HOLD_MS = 2000;
const unsigned long SENSOR_INTERVAL_MS = 2000;
const unsigned long DISPLAY_INTERVAL_MS = 250;
const unsigned long WIFI_RETRY_INTERVAL_MS = 10000;

// Flame sensor was tested as active HIGH.
const int FLAME_ACTIVE_LEVEL = HIGH;

// ==================== OLED CONFIGURATION ====================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

Adafruit_SSD1306 display(
  SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET
);
DHT dht(DHT_PIN, DHT_TYPE);
WebServer server(80);

// ==================== SENSOR DATA ====================
float temperature = NAN;
float humidity = NAN;
int lightValue = 0;

bool dhtValid = false;
bool flameDetected = false;
bool acIndicator = false;
bool vibrationDetected = false;

// ==================== SENSOR ENABLE SETTINGS ====================
// These settings are controlled by the web dashboard.
// They reset to ON after an ESP32 reboot.
bool dhtMonitoringEnabled = true;
bool ldrMonitoringEnabled = true;
bool flameMonitoringEnabled = true;
bool vibrationMonitoringEnabled = true;

// ==================== AUTOMATION STATES ====================
bool roomLightOn = false;
bool redLedOn = false;

// ==================== VIBRATION TRACKING ====================
int lastVibrationState = LOW;
unsigned long lastVibrationChange = 0;
unsigned long lastSensorRead = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long lastWiFiRetry = 0;
unsigned long transitionCount = 0;

// ==================== WI-FI CONNECTION ====================
void connectWiFi() {
  Serial.println();
  Serial.println("Connecting to Wi-Fi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - startAttempt < 20000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected!");
    Serial.print("SSID: ");
    Serial.println(WiFi.SSID());
    Serial.print("ESP32 IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection failed.");
    Serial.println("The ESP32 will retry later.");
  }
}

// ==================== SENSOR ENABLE / DISABLE ====================
void applySensorSettings() {
  // Disabled sensors must not leave stale detections or outputs active.
  if (!dhtMonitoringEnabled) {
    dhtValid = false;
    temperature = NAN;
    humidity = NAN;
    acIndicator = false;
    digitalWrite(YELLOW_LED, LOW);
  }

  if (!ldrMonitoringEnabled) {
    lightValue = 0;
    roomLightOn = false;
    digitalWrite(GREEN_LED, LOW);
  }

  if (!flameMonitoringEnabled) {
    flameDetected = false;
  }

  if (!vibrationMonitoringEnabled) {
    vibrationDetected = false;
    lastVibrationChange = 0;
    lastVibrationState = digitalRead(VIBRATION_PIN);
  }

  updateRedLED();
}

// ==================== SENSOR UPDATE ====================
void updateSensors() {
  unsigned long now = millis();
  if (now - lastSensorRead < SENSOR_INTERVAL_MS) {
    return;
  }
  lastSensorRead = now;

  // Read DHT11 only while monitoring is enabled.
  if (dhtMonitoringEnabled) {
    float newTemperature = dht.readTemperature();
    float newHumidity = dht.readHumidity();

    if (!isnan(newTemperature) && !isnan(newHumidity)) {
      temperature = newTemperature;
      humidity = newHumidity;
      dhtValid = true;
    } else {
      dhtValid = false;
      Serial.println("Warning: DHT11 reading failed.");
    }

    // Existing simulated AC hysteresis behavior.
    if (dhtValid) {
      if (temperature > AC_ON_TEMP) {
        acIndicator = true;
      } else if (temperature < AC_OFF_TEMP) {
        acIndicator = false;
      }
    }
    digitalWrite(YELLOW_LED, acIndicator ? HIGH : LOW);
  } else {
    dhtValid = false;
    temperature = NAN;
    humidity = NAN;
    acIndicator = false;
    digitalWrite(YELLOW_LED, LOW);
  }

  // Read LDR only while monitoring is enabled.
  if (ldrMonitoringEnabled) {
    lightValue = analogRead(LDR_PIN);
    // Existing tested behavior: higher ADC means darker surroundings.
    roomLightOn = (lightValue > LIGHT_THRESHOLD);
    digitalWrite(GREEN_LED, roomLightOn ? HIGH : LOW);
  } else {
    lightValue = 0;
    roomLightOn = false;
    digitalWrite(GREEN_LED, LOW);
  }

  // Flame detection.
  if (flameMonitoringEnabled) {
    flameDetected = (digitalRead(FLAME_PIN) == FLAME_ACTIVE_LEVEL);
  } else {
    flameDetected = false;
  }

  Serial.println("-------- Sensor Status --------");

  if (dhtMonitoringEnabled && dhtValid) {
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" C");
    Serial.print("Humidity: ");
    Serial.print(humidity);
    Serial.println(" %");
  } else if (!dhtMonitoringEnabled) {
    Serial.println("DHT11 monitoring: DISABLED");
  } else {
    Serial.println("Temperature/Humidity: Invalid");
  }

  if (ldrMonitoringEnabled) {
    Serial.print("LDR ADC: ");
    Serial.println(lightValue);
    Serial.print("Room light: ");
    Serial.println(roomLightOn ? "ON" : "OFF");
  } else {
    Serial.println("LDR monitoring: DISABLED");
  }

  Serial.print("AC indicator: ");
  Serial.println(acIndicator ? "ON" : "OFF");

  Serial.print("Flame: ");
  if (!flameMonitoringEnabled) {
    Serial.println("MONITORING DISABLED");
  } else {
    Serial.println(flameDetected ? "DETECTED" : "NOT DETECTED");
  }

  Serial.print("Vibration: ");
  if (!vibrationMonitoringEnabled) {
    Serial.println("MONITORING DISABLED");
  } else {
    Serial.println(vibrationDetected ? "DETECTED" : "NOT DETECTED");
  }

  Serial.println("-------------------------------");
}

// ==================== VIBRATION DETECTION ====================
void updateVibration() {
  if (!vibrationMonitoringEnabled) {
    vibrationDetected = false;
    lastVibrationChange = 0;
    lastVibrationState = digitalRead(VIBRATION_PIN);
    return;
  }

  int currentState = digitalRead(VIBRATION_PIN);

  // Detect transitions rather than treating a steady level as vibration.
  if (currentState != lastVibrationState) {
    lastVibrationState = currentState;
    lastVibrationChange = millis();
    transitionCount++;
  }

  // Keep alert active for 2 seconds after the latest transition.
  vibrationDetected =
    (lastVibrationChange != 0 &&
     millis() - lastVibrationChange < VIBRATION_HOLD_MS);
}

// ==================== RED LED SAFETY ALERT ====================
void updateRedLED() {
  redLedOn =
    (flameMonitoringEnabled && flameDetected) ||
    (vibrationMonitoringEnabled && vibrationDetected);

  digitalWrite(RED_LED, redLedOn ? HIGH : LOW);
}

// ==================== OLED DISPLAY ====================
void updateDisplay() {
  unsigned long now = millis();
  if (now - lastDisplayUpdate < DISPLAY_INTERVAL_MS) {
    return;
  }
  lastDisplayUpdate = now;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  display.setCursor(0, 0);
  display.println("SMART HOME MONITOR");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setCursor(0, 14);
  if (!dhtMonitoringEnabled) {
    display.println("DHT11: DISABLED");
  } else if (dhtValid) {
    display.print("Temp: ");
    display.print(temperature, 1);
    display.print(" C  Hum: ");
    display.print(humidity, 0);
    display.println("%");
  } else {
    display.println("DHT11: Sensor error");
  }

  display.setCursor(0, 26);
  if (ldrMonitoringEnabled) {
    display.print("Light ADC: ");
    display.println(lightValue);
  } else {
    display.println("LDR: DISABLED");
  }

  display.setCursor(0, 38);
  display.print("Room Light: ");
  display.println(roomLightOn ? "ON" : "OFF");

  display.setCursor(0, 48);
  display.print("AC: ");
  display.print(acIndicator ? "ON" : "OFF");
  display.print(" Flame: ");
  if (!flameMonitoringEnabled) {
    display.println("OFF");
  } else {
    display.println(flameDetected ? "YES" : "NO");
  }

  display.setCursor(0, 57);
  display.print("Vibration: ");
  if (!vibrationMonitoringEnabled) {
    display.print("OFF");
  } else {
    display.print(vibrationDetected ? "YES" : "NO");
  }

  display.display();
}

// ==================== JSON API ====================
String buildStatusJson() {
  String json;
  json.reserve(450);
  json = "{";

  json += "\"temperature\":";
  if (dhtMonitoringEnabled && dhtValid) {
    json += String(temperature, 1);
  } else {
    json += "null";
  }

  json += ",\"humidity\":";
  if (dhtMonitoringEnabled && dhtValid) {
    json += String(humidity, 1);
  } else {
    json += "null";
  }

  json += ",\"lightADC\":";
  if (ldrMonitoringEnabled) {
    json += String(lightValue);
  } else {
    json += "null";
  }

  json += ",\"flameDetected\":";
  json += ((flameMonitoringEnabled && flameDetected) ? "true" : "false");

  json += ",\"vibrationDetected\":";
  json += ((vibrationMonitoringEnabled && vibrationDetected) ? "true" : "false");

  json += ",\"roomLightOn\":";
  json += (roomLightOn ? "true" : "false");

  json += ",\"acIndicatorOn\":";
  json += (acIndicator ? "true" : "false");

  json += ",\"redLedOn\":";
  json += (redLedOn ? "true" : "false");

  json += ",\"wifiConnected\":";
  json += (WiFi.status() == WL_CONNECTED ? "true" : "false");

  json += ",\"dhtMonitoringEnabled\":";
  json += (dhtMonitoringEnabled ? "true" : "false");

  json += ",\"ldrMonitoringEnabled\":";
  json += (ldrMonitoringEnabled ? "true" : "false");

  json += ",\"flameMonitoringEnabled\":";
  json += (flameMonitoringEnabled ? "true" : "false");

  json += ",\"vibrationMonitoringEnabled\":";
  json += (vibrationMonitoringEnabled ? "true" : "false");

  json += "}";
  return json;
}

// ==================== SETTINGS API ====================
bool parseBoolArg(const String& name, bool currentValue) {
  if (!server.hasArg(name)) {
    return currentValue;
  }

  String value = server.arg(name);
  value.toLowerCase();

  if (value == "1" || value == "true" || value == "on") {
    return true;
  }
  if (value == "0" || value == "false" || value == "off") {
    return false;
  }
  return currentValue;
}

void handleSettingsPost() {
  dhtMonitoringEnabled =
    parseBoolArg("dht", dhtMonitoringEnabled);
  ldrMonitoringEnabled =
    parseBoolArg("ldr", ldrMonitoringEnabled);
  flameMonitoringEnabled =
    parseBoolArg("flame", flameMonitoringEnabled);
  vibrationMonitoringEnabled =
    parseBoolArg("vibration", vibrationMonitoringEnabled);

  applySensorSettings();

  server.send(200, "application/json", buildStatusJson());
}

// ==================== HTTP SERVER ====================
void setupWebServer() {
  server.on("/", HTTP_GET, []() {
    server.send(
      200,
      "text/plain",
      "Smart Home ESP32 API is running. Open /status for sensor data."
    );
  });

  server.on("/status", HTTP_GET, []() {
    server.send(200, "application/json", buildStatusJson());
  });

  // POST /settings with form fields:
  // dht=1&ldr=1&flame=0&vibration=1
  server.on("/settings", HTTP_POST, handleSettingsPost);

  // Also allow a simple GET form for easy manual testing.
  // The dashboard should use POST for changing settings.
  server.on("/settings", HTTP_GET, []() {
    dhtMonitoringEnabled =
      parseBoolArg("dht", dhtMonitoringEnabled);
    ldrMonitoringEnabled =
      parseBoolArg("ldr", ldrMonitoringEnabled);
    flameMonitoringEnabled =
      parseBoolArg("flame", flameMonitoringEnabled);
    vibrationMonitoringEnabled =
      parseBoolArg("vibration", vibrationMonitoringEnabled);

    applySensorSettings();
    server.send(200, "application/json", buildStatusJson());
  });

  server.onNotFound([]() {
    server.send(
      404,
      "application/json",
      "{\"error\":\"Endpoint not found. Try /status or /settings\"}"
    );
  });

  server.begin();
  Serial.println("HTTP server started on port 80");
}

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);

  pinMode(FLAME_PIN, INPUT);
  pinMode(VIBRATION_PIN, INPUT);

  pinMode(GREEN_LED, OUTPUT);
  pinMode(YELLOW_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);

  digitalWrite(GREEN_LED, LOW);
  digitalWrite(YELLOW_LED, LOW);
  digitalWrite(RED_LED, LOW);

  analogReadResolution(12);

  Wire.begin(OLED_SDA, OLED_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("OLED initialization failed!");
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Smart Home System");
    display.println("Starting...");
    display.display();
  }

  dht.begin();

  lastVibrationState = digitalRead(VIBRATION_PIN);

  connectWiFi();
  setupWebServer();

  Serial.println();
  Serial.println("System initialization complete.");
  Serial.println("Open the ESP32 IP address in a browser.");
}

// ==================== MAIN LOOP ====================
void loop() {
  server.handleClient();

  updateVibration();
  updateSensors();
  updateRedLED();
  updateDisplay();

  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastWiFiRetry >= WIFI_RETRY_INTERVAL_MS) {
    lastWiFiRetry = millis();
    Serial.println("Wi-Fi disconnected. Reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}
