const REFRESH_INTERVAL_MS = 2000;
const REQUEST_TIMEOUT_MS = 4000;

const $ = (id) => document.getElementById(id);

let requestInProgress = false;
let commandInProgress = false;
let refreshTimer = null;

const sensors = [
  {
    key: "dhtMonitoringEnabled",
    field: "dht",
    input: "dhtSwitch",
    state: "dhtState",
    label: "DHT11"
  },
  {
    key: "ldrMonitoringEnabled",
    field: "ldr",
    input: "ldrSwitch",
    state: "ldrState",
    label: "LDR"
  },
  {
    key: "flameMonitoringEnabled",
    field: "flame",
    input: "flameSwitch",
    state: "flameState",
    label: "Flame"
  },
  {
    key: "vibrationMonitoringEnabled",
    field: "vibration",
    input: "vibrationSwitch",
    state: "vibrationState",
    label: "Vibration"
  }
];

function setText(id, value) {
  $(id).textContent = value;
}

function formatValue(value, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "--";
  }

  return `${value}${unit}`;
}

function setConnection(connected) {
  const pill = $("connectionPill");

  pill.classList.toggle("connected", connected);
  pill.classList.toggle("disconnected", !connected);

  setText(
    "connectionText",
    connected ? "Connected" : "Disconnected"
  );
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}

function renderDetection(prefix, enabled, detected) {
  const card = $(`${prefix}Card`);
  const text = $(`${prefix}Text`);
  const badge = $(`${prefix}Badge`);

  card.classList.toggle(
    "alerting",
    enabled && detected
  );

  badge.className = "state-badge";

  if (!enabled) {
    text.textContent = "Monitoring disabled";
    badge.textContent = "DISABLED";
    badge.classList.add("disabled");
  } else if (detected) {
    text.textContent =
      prefix === "flame"
        ? "Flame detected — check immediately!"
        : "Vibration detected";

    badge.textContent = "ALERT";
    badge.classList.add("alert");
  } else {
    text.textContent = "No alert detected";
    badge.textContent = "NORMAL";
  }
}

function render(status) {
  const dhtOn = status.dhtMonitoringEnabled === true;
  const ldrOn = status.ldrMonitoringEnabled === true;
  const flameOn = status.flameMonitoringEnabled === true;
  const vibrationOn = status.vibrationMonitoringEnabled === true;

  // Live environment values
  setText(
    "temperature",
    formatValue(status.temperature, " °C")
  );
  setText(
    "humidity",
    formatValue(status.humidity, " %")
  );
  setText(
    "lightADC",
    ldrOn ? formatValue(status.lightADC) : "--"
  );

  setText(
    "welcomeTemp",
    formatValue(status.temperature, " °C")
  );
  setText(
    "welcomeHumidity",
    formatValue(status.humidity, " %")
  );
  setText(
    "welcomeLight",
    ldrOn ? formatValue(status.lightADC) : "--"
  );

  setText(
    "temperatureHint",
    !dhtOn
      ? "Monitoring disabled"
      : status.temperature == null
        ? "Sensor reading unavailable"
        : "DHT11 sensor"
  );

  setText(
    "humidityHint",
    !dhtOn
      ? "Monitoring disabled"
      : status.humidity == null
        ? "Sensor reading unavailable"
        : "Relative humidity"
  );

  setText(
    "lightHint",
    !ldrOn
      ? "Monitoring disabled"
      : Number(status.lightADC) > 2700
        ? "Darker surroundings"
        : "Brighter surroundings"
  );

  // Safety detection
  renderDetection(
    "flame",
    flameOn,
    status.flameDetected === true
  );

  renderDetection(
    "vibration",
    vibrationOn,
    status.vibrationDetected === true
  );

  // Update switches only when no command is in flight.
  // This prevents polling from undoing the user's switch action.
  if (!commandInProgress) {
    sensors.forEach((sensor) => {
      const enabled = status[sensor.key] === true;

      $(sensor.input).checked = enabled;

      setText(
        sensor.state,
        enabled ? "Monitoring enabled" : "Monitoring disabled"
      );

      $(sensor.state).classList.toggle("off", !enabled);
    });
  }

  // Existing automation indicators
  setText(
    "roomLightStatus",
    ldrOn ? (status.roomLightOn ? "ON" : "OFF") : "DISABLED"
  );

  setText(
    "acStatus",
    dhtOn ? (status.acIndicatorOn ? "ON" : "OFF") : "DISABLED"
  );

  setText(
    "redLedStatus",
    status.redLedOn ? "ON" : "OFF"
  );

  $("roomLightStatus").classList.toggle(
    "on",
    ldrOn && status.roomLightOn === true
  );

  $("acStatus").classList.toggle(
    "on",
    dhtOn && status.acIndicatorOn === true
  );

  // Full-page blinking red alert for enabled safety sensors.
  const activeAlerts = [];

  if (flameOn && status.flameDetected === true) {
    activeAlerts.push("FLAME DETECTED");
  }

  if (vibrationOn && status.vibrationDetected === true) {
    activeAlerts.push("VIBRATION DETECTED");
  }

  const alertActive = activeAlerts.length > 0;

  document.body.classList.toggle(
    "alert-active",
    alertActive
  );

  $("alertOverlay").classList.toggle(
    "active",
    alertActive
  );

  $("alertOverlay").setAttribute(
    "aria-hidden",
    String(!alertActive)
  );

  if (alertActive) {
    setText("alertTitle", activeAlerts.join(" + "));

    setText(
      "alertMessage",
      "Visual alert active. Check the physical environment immediately."
    );

    setText("homeStatusTitle", "Attention required");

    setText(
      "homeStatusCopy",
      `${activeAlerts.join(" and ")}. Check the environment.`
    );

    setText("summaryTitle", "Safety alert active");
    $("summaryTitle").style.color = "var(--red)";
    $("summaryIcon").textContent = "!";
    $("summaryIcon").style.background = "#541c2c";
    $("summaryIcon").style.color = "#ffffff";
  } else {
    setText("homeStatusTitle", "All systems standing by");

    setText(
      "homeStatusCopy",
      "No active flame or vibration alerts from enabled sensors."
    );

    setText("summaryTitle", "System ready");
    $("summaryTitle").style.color = "";
    $("summaryIcon").textContent = "✓";
    $("summaryIcon").style.background = "";
    $("summaryIcon").style.color = "";
  }

  setText(
    "lastUpdated",
    `Last updated ${new Date().toLocaleTimeString()}`
  );
}

async function refreshStatus() {
  if (requestInProgress || commandInProgress) {
    return;
  }

  requestInProgress = true;

  try {
    const response = await fetchWithTimeout("/api/status");

    if (!response.ok) {
      throw new Error(`Status request failed: HTTP ${response.status}`);
    }

    const status = await response.json();

    // Confirm the response has the fields expected from this firmware.
    const requiredFields = [
      "dhtMonitoringEnabled",
      "ldrMonitoringEnabled",
      "flameMonitoringEnabled",
      "vibrationMonitoringEnabled"
    ];

    if (!requiredFields.every((key) => typeof status[key] === "boolean")) {
      throw new Error("Firmware response is missing sensor enable settings.");
    }

    setConnection(true);
    render(status);
  } catch (error) {
    setConnection(false);

    setText("homeStatusTitle", "Connection interrupted");
    setText(
      "homeStatusCopy",
      "Check the ESP32, hotspot, IP address, and local server."
    );
    setText("summaryTitle", "Waiting for ESP32");
    setText("lastUpdated", "No new reading received");

    console.error("Dashboard refresh error:", error);
  } finally {
    requestInProgress = false;
  }
}

async function changeSensor(sensor, enabled) {
  if (commandInProgress) {
    return;
  }

  commandInProgress = true;

  const input = $(sensor.input);
  input.disabled = true;

  setText(
    "controlFeedback",
    `Updating ${sensor.label} monitoring...`
  );

  const form = new URLSearchParams();
  form.set(sensor.field, enabled ? "1" : "0");

  try {
    const response = await fetchWithTimeout(
      "/api/settings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: form.toString()
      }
    );

    if (!response.ok) {
      throw new Error(`Settings request failed: HTTP ${response.status}`);
    }

    const status = await response.json();

    if (status[sensor.key] !== enabled) {
      throw new Error("ESP32 did not confirm the requested setting.");
    }

    setConnection(true);

    // Render the confirmed state from the ESP32 response.
    render(status);

    setText(
      "controlFeedback",
      `${sensor.label} monitoring ${enabled ? "enabled" : "disabled"}.`
    );
  } catch (error) {
    // Restore the switch to the last known server-confirmed state.
    input.checked = !enabled;

    setText(
      "controlFeedback",
      `Could not update ${sensor.label}. Check the firmware and connection.`
    );

    console.error("Sensor control error:", error);
  } finally {
    input.disabled = false;
    commandInProgress = false;

    // Fetch the latest status after the command has completed.
    await refreshStatus();
  }
}

// Attach an independent handler to each switch.
sensors.forEach((sensor) => {
  $(sensor.input).addEventListener("change", (event) => {
    changeSensor(sensor, event.target.checked);
  });
});

$("refreshButton").addEventListener("click", refreshStatus);

// Initial fetch and regular polling.
refreshStatus();
refreshTimer = setInterval(
  refreshStatus,
  REFRESH_INTERVAL_MS
);