# Smart Home Automation and Safety Monitoring System Using ESP32-S3

An IoT-based smart home monitoring system that uses an **ESP32-S3 microcontroller** to monitor environmental conditions, detect potential safety events, and automate indicator outputs. The system includes a responsive, iOS-inspired web dashboard with a dark glassmorphism interface, live sensor readings, interactive controls, sensor history graphs, and safety alerts.

The dashboard communicates with the ESP32-S3 over Wi-Fi through a local Node.js HTTP proxy.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Objectives](#2-objectives)
3. [Features](#3-features)
4. [System Architecture](#4-system-architecture)
5. [Hardware Components](#5-hardware-components)
6. [Pin Configuration](#6-pin-configuration)
7. [Working Principle](#7-working-principle)
8. [Software and Technologies](#8-software-and-technologies)
9. [Project Structure](#9-project-structure)
10. [Installation and Setup](#10-installation-and-setup)
11. [Running the Dashboard](#11-running-the-dashboard)
12. [API Endpoints](#12-api-endpoints)
13. [Dashboard Modules](#13-dashboard-modules)
14. [Sensor History and Data Storage](#14-sensor-history-and-data-storage)
15. [Safety Alert Behaviour](#15-safety-alert-behaviour)
16. [Configuration](#16-configuration)
17. [Testing and Validation](#17-testing-and-validation)
18. [Troubleshooting](#18-troubleshooting)
19. [Limitations](#19-limitations)
20. [Future Enhancements](#20-future-enhancements)
21. [Safety Disclaimer](#21-safety-disclaimer)

---

## 1. Project Overview

The Smart Home Automation and Safety Monitoring System is designed to demonstrate how embedded systems, sensors, Wi-Fi communication, and web technologies can be integrated into a single IoT application.

The ESP32-S3 collects readings from temperature and humidity, ambient light, flame, and vibration sensors. Based on the sensor readings and configured thresholds, the controller updates indicator LEDs and makes the current system status available through an HTTP interface.

A browser-based dashboard presents the sensor readings and automation states in a modern interface inspired by Apple's iOS design language. Users can monitor the system remotely over the same local network and enable or disable individual sensor-monitoring functions from the dashboard.

The project is intended for academic demonstration, IoT experimentation, and further development into a more complete smart home monitoring platform.

## 2. Objectives

- Monitor indoor temperature and relative humidity.
- Measure ambient light intensity using an LDR sensor.
- Detect flame-sensor activation.
- Detect vibration or disturbance using a vibration sensor.
- Automate indicator outputs based on sensor readings.
- Display live sensor data through a web dashboard.
- Provide remote sensor-monitoring controls over Wi-Fi.
- Visualize recent temperature, humidity, and light readings using line graphs.
- Record sensor events and safety-alert state changes.
- Demonstrate communication between embedded firmware and a web application.

## 3. Features

### Environmental monitoring

- Temperature monitoring using a DHT11 sensor.
- Relative humidity monitoring using a DHT11 sensor.
- Ambient light monitoring using an analog LDR module.
- Live values displayed on the dashboard.

### Safety monitoring

- Flame sensor status monitoring.
- Vibration and movement detection.
- Visual safety indicators.
- Prominent alert overlay when an enabled safety input is triggered.
- Alert acknowledgement and a persistent alert banner while the triggering condition remains active.

### Home automation indicators

- Green LED for the room-light automation indicator.
- Yellow LED for the temperature-based AC indicator.
- Red LED for flame or vibration alerts.

These LEDs are indicators for the prototype; they do not directly operate a real AC unit or a mains-powered lighting circuit.

### Web dashboard

- Dark, iOS-inspired glass-gradient interface.
- Responsive layout for desktop and mobile screens.
- Live readings and network connection status.
- Four sensor-monitoring switches.
- Temperature, humidity, and ambient-light history charts.
- Selectable chart ranges: 30 minutes, 2 hours, and 12 hours.
- Recent activity and event log.
- Browser-local history storage.
- Connection-error handling and reconnection attempts.

## 4. System Architecture

The project consists of three main layers.

1. **Hardware layer:** ESP32-S3, connected sensors, and indicator LEDs.
2. **Communication layer:** ESP32-S3 HTTP endpoints and a Node.js proxy.
3. **Presentation layer:** HTML, CSS, and JavaScript dashboard running in a web browser.

### Data flow

```text
DHT11 ──────────┐
LDR Module ─────┤
Flame Sensor ───┤
Vibration Sensor┤
                ▼
           ESP32-S3
       Sensor Processing
       Automation Logic
                │
                │ Wi-Fi / HTTP
                ▼
       Node.js Local Proxy
        http://127.0.0.1:3000
                │
                ▼
       Web Dashboard
     ┌──────────┼───────────┐
     ▼          ▼           ▼
 Live Values  Graphs    Safety Alerts
     │
     ▼
 Sensor Monitoring Controls
     │
     └──── HTTP command through proxy ────► ESP32-S3
```

The browser requests readings from the Node.js server. The Node.js server forwards those requests to the ESP32-S3 and returns its responses to the browser.

This proxy arrangement avoids relying on direct cross-origin browser requests to the ESP32-S3.

## 5. Hardware Components

| Component | Purpose |
|---|---|
| ESP32-S3 N16R8 | Main microcontroller and Wi-Fi communication |
| DHT11 | Temperature and humidity measurement |
| LDR module HW-486 | Ambient light measurement |
| Flame sensor HW-491 | Flame-sensor digital input |
| Vibration sensor HW-513 | Vibration or disturbance detection |
| Green LED | Room-light automation indicator |
| Yellow LED | AC automation indicator |
| Red LED | Safety-alert indicator |
| Current-limiting resistors | Protect indicator LEDs |
| Breadboard and jumper wires | Prototyping and interconnections |
| USB cable | Programming and powering the ESP32-S3 |

**Note:** The dashboard depends on the matching ESP32 firmware being installed and the sensors being connected to the configured GPIO pins.

## 6. Pin Configuration

The following table describes the current prototype configuration.

| Component | ESP32-S3 GPIO | Interface |
|---|---:|---|
| DHT11 data | GPIO 4 | Digital |
| Flame sensor DO | GPIO 5 | Digital |
| LDR module AO | GPIO 6 | Analog |
| Vibration sensor S | GPIO 7 | Digital |
| OLED SDA, if used | GPIO 8 | I²C |
| OLED SCL, if used | GPIO 9 | I²C |
| Green LED | GPIO 16 | Digital output |
| Yellow LED | GPIO 17 | Digital output |
| Red LED | GPIO 18 | Digital output |

The OLED is optional for the web-dashboard functionality. Its inclusion depends on the firmware version used.

### Wiring precautions

- Connect the sensor grounds to the ESP32-S3 ground.
- Confirm each module's operating voltage and output-voltage compatibility before connecting it to the ESP32-S3.
- Use a suitable series resistor for each LED.
- Verify the GPIO assignment in the installed firmware before powering the circuit.
- Do not connect mains voltage directly to ESP32 GPIO pins or indicator LEDs.

## 7. Working Principle

### 7.1 Temperature and humidity monitoring

The DHT11 provides temperature and relative humidity readings to the ESP32-S3. The firmware makes valid readings available to the dashboard through the status endpoint.

The temperature reading also controls the yellow AC indicator according to the configured hysteresis thresholds:

- Temperature above 30°C: turn the indicator ON.
- Temperature below 27°C: turn the indicator OFF.
- Temperature between 27°C and 30°C: retain the previous indicator state.

The hysteresis prevents the indicator from rapidly switching on and off when the temperature fluctuates near a single threshold.

### 7.2 Ambient light monitoring

The LDR module provides an analog reading through GPIO 6.

The current firmware uses an approximate ADC threshold of 2700:

- ADC reading above 2700: turn the green room-light indicator ON.
- ADC reading at or below 2700: turn the indicator OFF.

The relationship between ADC readings and actual brightness depends on the LDR module's circuit and surrounding light conditions. The threshold can be calibrated for the installation environment.

### 7.3 Flame detection

The flame sensor's digital output is monitored by the ESP32-S3. When the firmware reports flame detection while monitoring is enabled, the system activates the red indicator and the dashboard displays a safety alert.

The sensor is a prototype detection input, not a certified fire-detection device.

### 7.4 Vibration detection

The vibration module is monitored for digital state transitions. The current firmware uses transition-based detection and a two-second hold period after the last detected transition.

When vibration monitoring is enabled and the firmware reports a vibration event, the red indicator and dashboard safety-alert interface are activated.

This behaviour detects activity from the module; it does not provide calibrated vibration magnitude or guarantee detection of every disturbance.

### 7.5 Sensor-monitoring controls

The dashboard has four independent switches:

- Temperature and humidity monitoring
- Ambient light monitoring
- Flame monitoring
- Vibration monitoring

Changing a switch sends a request through the Node.js proxy to the ESP32-S3. The dashboard then uses the returned status to verify that the requested change was applied.

The current firmware stores these settings in RAM. They return to their firmware defaults after an ESP32-S3 reboot.

## 8. Software and Technologies

| Technology | Role |
|---|---|
| Arduino IDE | ESP32-S3 firmware development and upload |
| C/C++ | Embedded firmware |
| HTML5 | Dashboard structure |
| CSS3 | Responsive styling, gradients, and glassmorphism |
| JavaScript | Live updates, controls, charts, and alerts |
| Node.js | Local HTTP server and proxy |
| Node.js built-in `http` module | HTTP server and ESP32 communication |
| Browser Fetch API | Dashboard-to-proxy requests |
| HTML Canvas API | Sensor-history charts |
| Browser `localStorage` | Local history and event-log persistence |
| Wi-Fi | Local network communication |
| JSON | Sensor-status data exchange |
| URL-encoded form data | Sensor-setting commands |

The provided Node.js server uses built-in modules, so no third-party Node.js packages are required for the server code shown in this project.

## 9. Project Structure

The dashboard directory should contain the following files:

```text
smart-home-monitor/
├── index.html      # Dashboard layout and interface
├── style.css       # Dark glass-gradient design and responsive layout
├── app.js          # Live readings, controls, charts, and alerts
├── server.js       # Local server and ESP32-S3 HTTP proxy
└── README.md       # Project documentation
```

The ESP32 firmware is maintained separately in the Arduino IDE sketch.

### File responsibilities

**`index.html`**

Defines the dashboard sections, environmental metric cards, safety indicators, automation outputs, monitoring switches, history charts, event log, and alert overlay.

**`style.css`**

Defines the dark iOS-inspired visual theme, translucent cards, gradients, typography, status badges, switches, alert styling, and responsive layout.

**`app.js`**

Fetches status data, updates the interface, sends sensor-control commands, records local history, renders charts, and manages safety alerts.

**`server.js`**

Serves the dashboard files and forwards API requests to the ESP32-S3. It buffers incoming request bodies and forwards them with an explicit content length.

**`README.md`**

Explains the system architecture, hardware, setup, operation, and troubleshooting.

## 10. Installation and Setup

### Prerequisites

Install or prepare the following:

- Node.js on the computer running the dashboard.
- Arduino IDE and the ESP32 board support required by your firmware.
- A compatible ESP32-S3 firmware sketch.
- The dashboard files listed above.
- A Wi-Fi network that the ESP32-S3 and computer can both access.

### Step 1: Create the project folder

For example, create:

```text
E:\vs-code\smart-home-monitor
```

Place `index.html`, `style.css`, `app.js`, `server.js`, and `README.md` inside this directory.

### Step 2: Configure the ESP32-S3

Upload the working Arduino firmware to the ESP32-S3.

Confirm that the firmware:

- Connects to the intended Wi-Fi network.
- Exposes `GET /status`.
- Exposes `POST /settings`.
- Returns the expected JSON keys.
- Supports the four sensor-monitoring settings.
- Maintains the expected GPIO assignments and automation logic.

### Step 3: Identify the ESP32-S3 IP address

Find the IP address assigned to the ESP32-S3 by the Wi-Fi network. You can use the IP address printed by the firmware's Serial Monitor or the connected-device list on the router or hotspot.

For example, the current configuration uses:

```text
10.210.241.104
```

This is an example of the current project configuration, not a permanent address. Your actual IP may change.

### Step 4: Configure `server.js`

Open `server.js` and verify these values:

```javascript
const PORT = 3000;
const ESP32_IP = "10.210.241.104";
const ESP32_PORT = 80;
```

Update `ESP32_IP` if the device has received a different address. Keep `PORT` and `ESP32_PORT` consistent with your intended local server and ESP32 HTTP server configuration.

### Step 5: Connect the computer and ESP32-S3

Connect both devices to the same Wi-Fi network, such as the same phone hotspot.

Confirm that the computer can reach the ESP32-S3 before troubleshooting the dashboard.

### Step 6: Open a terminal

Open PowerShell or the VS Code terminal and change to the project directory:

```powershell
cd E:\vs-code\smart-home-monitor
```

Check that Node.js is installed:

```powershell
node --version
```

### Step 7: Start the server

Run:

```powershell
node server.js
```

The server should print a message indicating that the Smart Home Monitor is running and showing the dashboard and ESP32 API addresses.

## 11. Running the Dashboard

Once the server is running, open the following address in your browser:

**http://127.0.0.1:3000**

Do not use the Live Server URL for the final proxy-based setup. The dashboard should be opened through the Node.js server so its `/api/status` and `/api/settings` requests reach the configured proxy.

### Expected startup behaviour

1. The dashboard initially shows a connecting state.
2. JavaScript requests the latest sensor status.
3. The Node.js server forwards the request to the ESP32-S3.
4. The browser updates the displayed readings and sensor states.
5. The dashboard continues polling for updates approximately every 1.8 seconds.

Keep the terminal running while using the dashboard. Closing the Node.js process stops the local server.

After changing the frontend files, refresh the browser with **Ctrl + F5** to bypass cached assets.

## 12. API Endpoints

The dashboard communicates with the Node.js proxy, which forwards requests to the ESP32-S3.

### Local dashboard endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/status` | Retrieve current ESP32-S3 status |
| POST | `/api/settings` | Update sensor-monitoring settings |

### ESP32-S3 endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/status` | Return current sensor and automation status |
| POST | `/settings` | Apply sensor-monitoring settings |
| GET | `/settings?ldr=0` | Optional direct query-based setting supported by the firmware |

### Example status response

The firmware is expected to return JSON with the following fields:

```json
{
  "temperature": 28.5,
  "humidity": 55,
  "lightADC": 2300,
  "flameDetected": false,
  "vibrationDetected": false,
  "roomLightOn": false,
  "acIndicatorOn": false,
  "redLedOn": false,
  "wifiConnected": true,
  "dhtMonitoringEnabled": true,
  "ldrMonitoringEnabled": true,
  "flameMonitoringEnabled": true,
  "vibrationMonitoringEnabled": true
}
```

**Important:** The values above are illustrative, not live measurements. Temperature and humidity can be `null` when valid readings are unavailable or DHT monitoring is disabled. The frontend expects the property names shown above.

### Example sensor-setting request

To disable LDR monitoring through the local proxy:

```http
POST /api/settings
Content-Type: application/x-www-form-urlencoded

ldr=0
```

To enable it again:

```http
POST /api/settings
Content-Type: application/x-www-form-urlencoded

ldr=1
```

The equivalent browser JavaScript request is:

```javascript
fetch("/api/settings", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  },
  body: new URLSearchParams({ ldr: "0" }).toString()
});
```

The server forwards the request body to the ESP32-S3 and returns its response to the browser.

### Supported setting fields

| Field | Controls |
|---|---|
| `dht` | DHT11 temperature and humidity monitoring |
| `ldr` | Ambient-light monitoring |
| `flame` | Flame detection |
| `vibration` | Vibration detection |

The firmware accepts enabled and disabled values such as `1` and `0`, respectively, along with supported textual equivalents.

## 13. Dashboard Modules

### Home overview

Displays the overall monitoring state, current connection status, and a short system summary.

### Environment

Shows:

- Temperature in degrees Celsius.
- Relative humidity as a percentage.
- Ambient light as an ADC reading.
- Network connectivity and last-update information.

### Protection

Shows the state of the flame and vibration sensors, including normal, alert, disabled, and initial checking states.

### Outputs

Displays the reported states of the room-light and AC indicator outputs.

These states are read from the ESP32-S3 response rather than treated as independent browser-side hardware controls.

### Monitoring

Provides four switches that send commands to the ESP32-S3 to enable or disable the corresponding monitoring functions.

The switch state is reconciled with the returned status. If a command fails or the firmware does not confirm the requested state, the dashboard reports the error and restores the previous switch state.

### Sensor trends

Provides three history charts:

- Temperature
- Humidity
- Ambient light

Users can choose between 30-minute, 2-hour, and 12-hour viewing ranges.

### Event log

Records significant events, such as safety alerts, alert clearance, sensor-setting changes, and connection interruptions.

### Safety notification

Displays a prominent overlay when an enabled flame or vibration input reports a trigger. The overlay can be acknowledged, while the alert banner remains visible until the triggering input returns to normal.

## 14. Sensor History and Data Storage

Sensor history and event logs are stored in the browser's `localStorage`.

The application uses the following storage keys:

```text
smartHomeMonitorHistoryV1
smartHomeMonitorEventsV1
```

### History behaviour

- Samples are collected when the dashboard successfully receives status responses.
- The application retains up to 1,800 history samples.
- The charts filter the saved samples according to the selected time range.
- The event log retains up to 60 events in storage and displays a recent subset.
- History and events persist across page refreshes in the same browser profile until cleared or browser storage is removed.

### Important limitations

The history is not stored on the ESP32-S3, in a database, or in a cloud service.

It is local to the browser and device used to access the dashboard. Opening the dashboard on another device will not automatically share the history.

The dashboard must be running to collect new samples. It does not reconstruct sensor history for periods when it was closed or disconnected.

## 15. Safety Alert Behaviour

The alert system is driven by the latest status received from the ESP32-S3.

### Alert activation

An alert is raised when either of these conditions is reported:

- Flame monitoring is enabled and `flameDetected` is `true`.
- Vibration monitoring is enabled and `vibrationDetected` is `true`.

If both conditions are active, the dashboard reports multiple safety alerts.

### Alert acknowledgement

The user can acknowledge the overlay to dismiss it from the immediate view. Acknowledgement does not disable the sensor or clear the underlying condition.

The alert banner remains visible while a monitored safety input is triggered. A new alert condition can bring the overlay back into view.

### Alert clearance

When the enabled safety inputs return to normal, the overlay is dismissed and a clearance event is recorded.

### Connection loss

If the dashboard cannot retrieve a status response, it indicates that the connection is interrupted and attempts to reconnect.

**A connection failure must not be interpreted as confirmation that the environment is safe.** The latest displayed values may be stale while the device is unreachable.

The browser polls approximately every 1.8 seconds. A short event may occur between successful polls and therefore may not be shown by the dashboard. The vibration firmware's own detection and hold behaviour also affects which events are visible.

## 16. Configuration

### Changing the ESP32-S3 IP address

Edit the `ESP32_IP` constant in `server.js` whenever the ESP32-S3 receives a different address.

If the address changes frequently, consider configuring a DHCP reservation on the router or hotspot where supported.

### Changing sensor thresholds

Sensor thresholds and detection timing are defined in the ESP32 firmware, not in the dashboard's CSS.

For the current configuration:

| Function | Current setting |
|---|---|
| LDR room-light indicator | ON when ADC is above 2700 |
| AC indicator ON threshold | Temperature above 30°C |
| AC indicator OFF threshold | Temperature below 27°C |
| Vibration hold period | 2 seconds after the last transition |
| Dashboard polling interval | Approximately 1.8 seconds |

Change these values in the firmware only after verifying the circuit's actual behaviour.

### Changing the dashboard theme

Edit `style.css` to customize the dark background, translucent cards, gradient effects, typography, accent colours, and responsive breakpoints.

Edit `index.html` to change the page structure and visible labels.

Edit `app.js` to change frontend behaviour. Keep its element IDs and API field names consistent with the HTML and firmware.

## 17. Testing and Validation

Perform the following checks after installation.

### Hardware checks

- Confirm that the ESP32-S3 boots and connects to Wi-Fi.
- Confirm that each sensor is connected to the correct GPIO.
- Compare dashboard readings with the sensor's observed behaviour.
- Test the LDR response under different lighting conditions.
- Test the flame sensor using its appropriate test procedure.
- Test the vibration module by creating a controlled disturbance.
- Verify the green, yellow, and red LED outputs.

### Communication checks

- Open `http://127.0.0.1:3000`.
- Verify that the connection indicator changes to connected when status retrieval succeeds.
- Confirm that readings update over time.
- Verify that `/api/status` returns JSON.
- Toggle each monitoring switch and confirm that the returned state matches the requested setting.

### Dashboard checks

- Confirm that the three history charts begin collecting samples.
- Change the chart time range.
- Confirm that history and events remain after refreshing the browser.
- Test the clear-history and clear-event-log controls.
- Trigger a controlled flame-sensor or vibration-sensor event and verify the alert overlay.
- Acknowledge the alert and confirm that the persistent banner remains while the input is still triggered.
- Disconnect the ESP32-S3 or interrupt Wi-Fi in a controlled test to verify connection-error handling.

Record actual test results separately if this project is being submitted for academic evaluation.

## 18. Troubleshooting

### Dashboard does not open

**Possible causes:** Node.js is not installed, the server is not running, or port 3000 is already in use.

**Checks:**

```powershell
node --version
node server.js
```

Read the terminal output for startup errors. If port 3000 is occupied, stop the other process or change the configured port consistently.

### Dashboard reports that the ESP32-S3 is offline

**Possible causes:** Incorrect IP address, different Wi-Fi networks, ESP32 disconnection, or firmware HTTP server failure.

**Checks:**

1. Confirm the ESP32-S3 IP address.
2. Update `ESP32_IP` in `server.js` if necessary.
3. Ensure both devices are on the same reachable network.
4. Check the ESP32-S3 Serial Monitor.
5. Test the ESP32 status endpoint directly:

   ```text
   http://10.210.241.104/status
   ```

   Replace the example IP with the current device address.

### `/api/status` returns HTTP 502

The Node.js proxy could not successfully retrieve a response from the ESP32-S3.

Check the ESP32 address, Wi-Fi connection, HTTP server, and terminal error message. The proxy uses an eight-second request timeout.

### Sensor switch returns to its previous state

The frontend verifies the setting against the response returned by the ESP32-S3.

Check that the firmware supports `POST /settings`, accepts the relevant field name, applies the requested setting, and returns the updated status. Confirm that the server is forwarding the request body correctly.

### Sensor readings display a dash

A dash can indicate an unavailable reading or disabled monitoring.

Check the sensor connection, firmware output, monitoring switch, and JSON response. For DHT11, verify that the reported values are valid numbers when monitoring is enabled.

### Graphs are empty

The history begins collecting when the dashboard receives successful status responses. It cannot display data that was never recorded.

Keep the dashboard open and connected long enough to collect samples. Check browser storage settings if history does not persist after a refresh.

### Alerts do not appear

Confirm that the corresponding sensor-monitoring switch is enabled and that the ESP32-S3 status response reports the detection flag as `true`.

The dashboard relies on the firmware's detection logic and periodic polling. Very brief events may not be visible if they occur between polls.

### The page still shows the old design

Refresh with **Ctrl + F5**. Confirm that `index.html`, `style.css`, and `app.js` are in the directory served by `server.js`.

## 19. Limitations

- Sensor readings depend on the accuracy, calibration, and limitations of the connected modules.
- LDR thresholds depend on the module and ambient lighting.
- DHT11 measurements have limited accuracy and update characteristics.
- The flame sensor is not a certified fire alarm.
- The vibration sensor does not measure calibrated vibration magnitude.
- Browser history is local and is not centrally synchronized.
- The dashboard must be open to collect history and evaluate incoming alerts.
- Network interruptions prevent the dashboard from receiving fresh readings.
- The monitoring settings reset to their firmware defaults after the ESP32-S3 restarts.
- The indicator LEDs demonstrate automation logic; they do not control actual mains-powered appliances.
- The local settings endpoint has no authentication. The system is intended for a trusted local network, not direct exposure to the public internet.

## 20. Future Enhancements

Potential extensions include:

- Persistent storage using SQLite, MySQL, or another database.
- Historical data access across multiple browsers and devices.
- Secure authentication and authorization.
- MQTT-based communication for a larger IoT deployment.
- Mobile-friendly installation as a progressive web app.
- More advanced charts and historical filtering.
- Configurable sensor thresholds from the dashboard.
- Push notifications through an appropriate notification service.
- A dedicated, independent hardware alarm with suitable power backup.
- Integration with properly rated relay modules and electrical protection for real appliances.
- Better event buffering and delivery guarantees for brief sensor triggers.
- Deployment to a secured server for remote access.

These are possible future improvements, not features currently guaranteed by the implementation.

## 21. Safety Disclaimer

This project is an educational IoT prototype intended for monitoring and demonstration.

It must not be used as the sole fire-detection, intrusion-detection, or life-safety system in a home. Sensor readings can be incorrect, events can be missed, and network or power failures can interrupt monitoring.

For real-world protection, use certified safety equipment and appropriate installation practices. Never connect mains-powered appliances directly to microcontroller GPIO pins.

---

## Project Summary

The Smart Home Automation and Safety Monitoring System integrates an ESP32-S3, environmental and safety sensors, indicator-based automation, a Node.js HTTP proxy, and a browser dashboard.

It demonstrates embedded sensor processing, Wi-Fi communication, web-based monitoring, interactive hardware controls, browser-side data visualization, and event-driven safety notifications in a single IoT prototype.

**Dashboard URL:** `http://127.0.0.1:3000`

**Local proxy:** Node.js

**Microcontroller:** ESP32-S3 N16R8

**Interface:** iOS-inspired dark glass-gradient web dashboard
