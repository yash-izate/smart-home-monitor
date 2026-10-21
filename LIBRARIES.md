# Smart Home Automation — Required Libraries

This project uses an ESP32-S3, Arduino firmware, and a Node.js dashboard server.

## ESP32-S3 Arduino libraries

| Library / Header | Purpose | Installation |
|---|---|---|
| `WiFi.h` | Connects the ESP32-S3 to the phone hotspot over Wi-Fi | Included with the ESP32 Arduino board package |
| `WebServer.h` | Hosts the ESP32 HTTP API (`/status` and `/settings`) | Included with the ESP32 Arduino board package |
| `Wire.h` | I²C communication with the OLED display | Included with the Arduino/ESP32 core |
| `Adafruit GFX Library` (`Adafruit_GFX.h`) | Graphics and text rendering for the OLED | Install via Arduino IDE Library Manager |
| `Adafruit SSD1306` (`Adafruit_SSD1306.h`) | Drives the SSD1306 OLED display | Install via Arduino IDE Library Manager |
| `DHT sensor library` (`DHT.h`) by Adafruit | Reads temperature and humidity from the DHT11 | Install via Arduino IDE Library Manager |
| `Adafruit Unified Sensor` | Dependency used by Adafruit sensor libraries; install if prompted or missing | Install via Arduino IDE Library Manager |

## Install using Arduino IDE

1. Open **Arduino IDE**.
2. Go to **Sketch → Include Library → Manage Libraries** (or open **Library Manager**).
3. Search for and install:
   - `Adafruit GFX Library`
   - `Adafruit SSD1306`
   - `DHT sensor library` by Adafruit
   - `Adafruit Unified Sensor` by Adafruit, if it is not already installed.
4. In **Tools → Board**, select the appropriate ESP32-S3 board and ensure the Espressif ESP32 board package is installed.

## Node.js server and web dashboard

- `server.js` currently uses Node.js built-in modules according to the project setup; built-in modules do not need separate npm installation.
- The dashboard files `index.html`, `style.css`, and `app.js` use browser HTML, CSS, and JavaScript. No Python packages are required for these files.
- This document is a library list, not a Python `requirements.txt`. Use `requirements.txt` only if you add a Python component.

## Notes

- `WiFi.h`, `WebServer.h`, and `Wire.h` should not normally be installed separately through Library Manager; they come with the ESP32/Arduino core.
- Exact dependency requirements can vary slightly by installed library version.
