
const ESP32_BASE_URL = "";

const REFRESH_INTERVAL_MS = 2000;
const REQUEST_TIMEOUT_MS = 4000;

const $ = (id) => document.getElementById(id);

let requestInProgress = false;
let lastSuccessfulData = null;

function setBadge(id, text, type = "") {
  const badge = $(id);
  badge.textContent = text;
  badge.className = "badge" + (type ? ` ${type}` : "");
}

function setConnection(connected, text) {
  $("connection").className =
    "connection " + (connected ? "connected" : "disconnected");

  $("connectionText").textContent = text;
}

function showError(message) {
  $("errorMessage").textContent = message;
  $("errorMessage").hidden = false;
}

function clearError() {
  $("errorMessage").hidden = true;
}

function displayReading(id, value, unit = "") {
  $(id).textContent =
    value === null || value === undefined
      ? "--"
      : `${value}${unit}`;
}

function displayDetection({
  enabled,
  detected,
  statusId,
  badgeId,
  cardId,
  label
}) {
  const card = $(cardId);
  card.style.borderColor = "";

  if (enabled === false) {
    $(statusId).textContent = "Monitoring disabled";
    setBadge(badgeId, "DISABLED", "warning");
    return "disabled";
  }

  if (enabled === null) {
    $(statusId).textContent = "Status unavailable";
    setBadge(badgeId, "UNKNOWN");
    return "unknown";
  }

  if (detected === true) {
    $(statusId).textContent = `${label} detected`;
    setBadge(badgeId, "ALERT", "alert");
    card.style.borderColor = "var(--red)";
    return "alert";
  }

  $(statusId).textContent = "No alert detected";
  setBadge(badgeId, "NORMAL", "on");
  return "normal";
}

function displayOutput(id, value) {
  if (typeof value !== "boolean") {
    setBadge(id, "UNKNOWN");
  } else {
    setBadge(id, value ? "ON" : "OFF", value ? "on" : "off");
  }
}

function renderDashboard(data) {
  const dhtEnabled = data.dhtMonitoringEnabled !== false;

  displayReading(
    "temperature",
    dhtEnabled ? data.temperature : null,
    " °C"
  );

  displayReading(
    "humidity",
    dhtEnabled ? data.humidity : null,
    " %"
  );

  displayReading("lightADC", data.lightADC);

  if (data.temperature == null && dhtEnabled) {
    $("temperature").textContent = "--";
  }

  if (data.humidity == null && dhtEnabled) {
    $("humidity").textContent = "--";
  }

  if (typeof data.lightADC === "number") {
    $("lightDescription").textContent =
      data.lightADC > 2700 ? "Dark surroundings" : "Brighter surroundings";
  } else {
    $("lightDescription").textContent = "Reading unavailable";
  }

  const flameState = displayDetection({
    enabled: data.flameMonitoringEnabled,
    detected: data.flameDetected,
    statusId: "flameStatus",
    badgeId: "flameBadge",
    cardId: "flameCard",
    label: "Flame"
  });

  const vibrationState = displayDetection({
    enabled: data.vibrationMonitoringEnabled,
    detected: data.vibrationDetected,
    statusId: "vibrationStatus",
    badgeId: "vibrationBadge",
    cardId: "vibrationCard",
    label: "Vibration"
  });

  displayOutput("roomLightState", data.roomLightOn);
  displayOutput("acState", data.acIndicatorOn);
  displayOutput("redLedState", data.redLedOn);

  const safety = $("overallSafety");
  safety.className = "overall-safety";

  const monitoringDisabled =
    flameState === "disabled" ||
    vibrationState === "disabled";

  const alertActive =
    flameState === "alert" ||
    vibrationState === "alert";

  if (alertActive) {
    safety.classList.add("alert");
    $("safetyIcon").textContent = "⚠️";
    $("safetyTitle").textContent = "Safety alert detected";
    $("safetyDescription").textContent =
      "Check the environment immediately.";
  } else if (monitoringDisabled) {
    safety.classList.add("warning");
    $("safetyIcon").textContent = "⚠️";
    $("safetyTitle").textContent = "Monitoring partially disabled";
    $("safetyDescription").textContent =
      "One or more safety sensors are not monitoring. Do not assume the area is safe.";
  } else if (flameState === "normal" && vibrationState === "normal") {
    $("safetyIcon").textContent = "✓";
    $("safetyTitle").textContent = "No alerts reported";
    $("safetyDescription").textContent =
      "Enabled sensors currently report no alerts. This does not guarantee safety.";
  } else {
    safety.classList.add("warning");
    $("safetyIcon").textContent = "!";
    $("safetyTitle").textContent = "Safety status unavailable";
    $("safetyDescription").textContent =
      "Sensor status is incomplete or unknown.";
  }

  $("lastUpdated").textContent =
    "Last updated: " + new Date().toLocaleTimeString();
}

async function refreshStatus() {
  if (requestInProgress) return;

  requestInProgress = true;
  $("refreshButton").disabled = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch("/api/status", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`ESP32 returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("The ESP32 returned invalid JSON data.");
    }

    lastSuccessfulData = data;

    renderDashboard(data);
    setConnection(true, "Connected");
    clearError();
  } catch (error) {
    setConnection(false, "Disconnected");

    if (lastSuccessfulData) {
      $("lastUpdated").textContent =
        "Connection lost. Displaying last successful readings.";
    } else {
      $("lastUpdated").textContent = "Waiting for ESP32 connection...";
    }

    showError(
      error.name === "AbortError"
        ? "The ESP32 request timed out. Check the IP address and network."
        : `Unable to fetch ESP32 data: ${error.message}`
    );
  } finally {
    clearTimeout(timeoutId);
    requestInProgress = false;
    $("refreshButton").disabled = false;
  }
}

$("refreshButton").addEventListener("click", refreshStatus);

refreshStatus();
setInterval(refreshStatus, REFRESH_INTERVAL_MS);
