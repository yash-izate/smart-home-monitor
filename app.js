(() => {
  "use strict";
  const API = { status: "/api/status", settings: "/api/settings" };
  const POLL_MS = 1800, HISTORY_KEY = "smartHomeMonitorHistoryV1", EVENTS_KEY = "smartHomeMonitorEventsV1";
  const MAX_SAMPLES = 1800, MAX_EVENTS = 60, $ = id => document.getElementById(id);
  const settings = {
    dht: { input: "toggleDht", key: "dhtMonitoringEnabled", label: "DHT11", field: "dht" },
    ldr: { input: "toggleLdr", key: "ldrMonitoringEnabled", label: "LDR", field: "ldr" },
    flame: { input: "toggleFlame", key: "flameMonitoringEnabled", label: "Flame sensor", field: "flame" },
    vibration: { input: "toggleVibration", key: "vibrationMonitoringEnabled", label: "Vibration sensor", field: "vibration" }
  };
  let history = load(HISTORY_KEY, []), events = load(EVENTS_KEY, []), lastStatus = null;
  let polling = false, commandInProgress = false, lastErrorAt = 0, toastTimer;
  let alertActive = false, alertAcknowledged = false, activeAlertKey = "", lastFocusedElement = null;

  function load(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value === null ? fallback : value; } catch (error) { console.warn(`Unable to load ${key}`, error); return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn(`Unable to save ${key}`, error); } }
  function text(id, value) { $(id).textContent = value; }
  function time(value, date = false) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], date ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  function number(value, digits = 1) { return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—"; }
  function toast(message) { const node = $("toast"); node.textContent = message; node.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("visible"), 2600); }
  function escape(value) { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
  function addEvent(title, description, type = "normal", timestamp = Date.now()) {
    if (events[0] && events[0].title === title && events[0].description === description && timestamp - events[0].timestamp < 1200) return;
    events.unshift({ title, description, type, timestamp }); events = events.slice(0, MAX_EVENTS); save(EVENTS_KEY, events); renderEvents();
  }
  function renderEvents() {
    const node = $("eventList");
    node.innerHTML = events.length ? events.slice(0, 12).map(event => `<div class="event-row"><span class="event-mark ${event.type === "alert" ? "alert" : event.type === "good" ? "good" : ""}"></span><div class="event-content"><strong>${escape(event.title)}</strong><p>${escape(event.description)}</p></div><time class="event-time">${escape(time(event.timestamp, true))}</time></div>`).join("") : '<div class="empty-state">Events will appear here as sensors change state.</div>';
  }
  function connection(connected, message) { $("connectionPill").classList.toggle("connected", connected); $("connectionPill").classList.toggle("offline", !connected); text("connectionText", message); text("networkValue", connected ? "Online" : "Offline"); }
  function badge(id, state, label) { const node = $(id); node.className = `state-badge ${state}`; node.textContent = label; }
  function output(id, on) { const node = $(id); node.className = `output-state ${on ? "on" : ""}`; node.textContent = on ? "ON" : "OFF"; }

  function renderStatus(status) {
    lastStatus = status;
    const connected = status.wifiConnected === true;
    const dht = status.dhtMonitoringEnabled === true, ldr = status.ldrMonitoringEnabled === true;
    const flameOn = status.flameMonitoringEnabled === true, vibrationOn = status.vibrationMonitoringEnabled === true;
    connection(connected, connected ? "Connected" : "Wi-Fi issue");
    text("lastUpdated", `Updated ${time(Date.now())}`); text("footerTime", `Updated ${time(Date.now())}`); text("staleLabel", connected ? "Fresh from ESP32" : "Reading unavailable");
    text("temperatureValue", dht ? number(status.temperature) : "—"); text("humidityValue", dht ? number(status.humidity) : "—");
    text("tempState", dht ? "ACTIVE" : "OFF"); text("humidityState", dht ? "ACTIVE" : "OFF");
    text("tempFoot", !dht ? "Monitoring off" : typeof status.temperature === "number" ? "Live room temperature" : "Reading unavailable");
    text("humidityFoot", !dht ? "Monitoring off" : typeof status.humidity === "number" ? "Relative humidity" : "Reading unavailable");
    text("lightValue", ldr && typeof status.lightADC === "number" ? String(status.lightADC) : "—"); text("lightState", ldr ? "ACTIVE" : "OFF");
    text("lightFoot", !ldr ? "Monitoring off" : status.roomLightOn ? "Low ambient light detected" : "Ambient light above threshold");
    text("flameDescription", !flameOn ? "Monitoring is disabled" : status.flameDetected ? "Potential flame detected" : "No flame detected");
    text("vibrationDescription", !vibrationOn ? "Monitoring is disabled" : status.vibrationDetected ? "Movement detected" : "No recent movement");
    badge("flameBadge", !flameOn ? "disabled" : status.flameDetected ? "danger" : "safe", !flameOn ? "DISABLED" : status.flameDetected ? "ALERT" : "NORMAL");
    badge("vibrationBadge", !vibrationOn ? "disabled" : status.vibrationDetected ? "danger" : "safe", !vibrationOn ? "DISABLED" : status.vibrationDetected ? "ALERT" : "NORMAL");
    $("flameCard").classList.toggle("danger-card", flameOn && status.flameDetected); $("vibrationCard").classList.toggle("danger-card", vibrationOn && status.vibrationDetected);
    output("roomLightState", status.roomLightOn === true); output("acState", status.acIndicatorOn === true);
    text("roomLightDescription", !ldr ? "LDR monitoring disabled" : status.roomLightOn ? "Darkness threshold reached" : "Ambient light sufficient");
    text("acDescription", !dht ? "DHT11 monitoring disabled" : typeof status.temperature !== "number" ? "Waiting for temperature" : `Temperature ${status.temperature.toFixed(1)}°C`);
    if (!commandInProgress) Object.values(settings).forEach(item => { $(item.input).checked = status[item.key] === true; });
    const flame = flameOn && status.flameDetected === true, vibration = vibrationOn && status.vibrationDetected === true;
    text("homeStatusTitle", flame ? "Safety alert active" : vibration ? "Movement detected" : connected ? "All systems normal" : "Connection interrupted");
    text("homeStatusDescription", flame ? "The flame input is active. Check the area immediately." : vibration ? "The vibration input has triggered recently." : connected ? "Sensors are reporting. Your home monitor is online." : "Check the ESP32 Wi-Fi connection.");
    recordSample(status); updateSafetyAlert(status); drawAllCharts();
  }
  async function refreshStatus() {
    if (polling) return; polling = true;
    try {
      const response = await fetch(`${API.status}?t=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
      const status = await response.json(); renderStatus(status);
      if (lastErrorAt) { toast("Connection restored"); lastErrorAt = 0; }
    } catch (error) {
      console.error("Status refresh failed:", error); connection(false, "Reconnecting"); text("homeStatusTitle", "Connection interrupted"); text("homeStatusDescription", "Trying to reconnect to the ESP32 monitor."); text("staleLabel", lastStatus ? "Showing last known values" : "No reading available");
      if (!lastErrorAt || Date.now() - lastErrorAt > 15000) { addEvent("Dashboard connection interrupted", "Could not retrieve the latest ESP32 status.", "normal"); lastErrorAt = Date.now(); }
    } finally { polling = false; }
  }
  async function changeSensor(name, enabled) {
    const item = settings[name]; if (!item || commandInProgress) return;
    const input = $(item.input), previous = !enabled; input.disabled = true; commandInProgress = true; text("settingsMessage", `Updating ${item.label}…`);
    try {
      const response = await fetch(API.settings, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ [item.field]: enabled ? "1" : "0" }).toString(), cache: "no-store" });
      const raw = await response.text(); if (!response.ok) throw new Error(`Settings HTTP ${response.status}: ${raw}`);
      const status = JSON.parse(raw); if (status[item.key] !== enabled) throw new Error(`${item.label} setting was not applied`);
      renderStatus(status); addEvent(`${item.label} monitoring ${enabled ? "enabled" : "disabled"}`, `${item.label} monitoring changed on the ESP32.`, enabled ? "good" : "normal"); text("settingsMessage", "Settings applied to the ESP32. They reset after reboot."); toast(`${item.label} ${enabled ? "enabled" : "disabled"}`);
    } catch (error) { console.error("Sensor setting failed:", error); input.checked = previous; text("settingsMessage", `Could not update ${item.label}. ${error.message}`); toast(`Could not update ${item.label}`); }
    finally { input.disabled = false; commandInProgress = false; refreshStatus(); }
  }
  function recordSample(status) {
    const sample = { t: Date.now(), temperature: typeof status.temperature === "number" && status.dhtMonitoringEnabled ? status.temperature : null, humidity: typeof status.humidity === "number" && status.dhtMonitoringEnabled ? status.humidity : null, light: typeof status.lightADC === "number" && status.ldrMonitoringEnabled ? status.lightADC : null };
    if (history[history.length - 1] && sample.t - history[history.length - 1].t < 700) return; history.push(sample); history = history.slice(-MAX_SAMPLES); save(HISTORY_KEY, history);
  }
  function rangeData(key) { const cutoff = Date.now() - Number($("historyRange").value) * 60000; return history.filter(item => item.t >= cutoff && Number.isFinite(item[key])); }
  function drawChart(canvasId, key, color, latestId, startId, tooltipId, digits) {
    const canvas = $(canvasId), parent = canvas.parentElement, width = Math.max(240, parent.clientWidth || 300), height = Math.max(110, parent.clientHeight || 160), dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = width * dpr; canvas.height = height * dpr; const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const data = rangeData(key), pad = { left: 35, right: 8, top: 13, bottom: 17 }, w = width - pad.left - pad.right, h = height - pad.top - pad.bottom;
    text(latestId, data.length ? `${data[data.length - 1][key].toFixed(digits)}${key === "temperature" ? "°" : key === "humidity" ? "%" : ""}` : "—"); text(startId, data.length ? time(data[0].t, true) : "No history yet");
    let min = data.length ? Math.min(...data.map(item => item[key])) : 0, max = data.length ? Math.max(...data.map(item => item[key])) : 1;
    if (key === "light") { min = 0; max = 4095; } else { if (min === max) { min -= key === "temperature" ? 1 : 2; max += key === "temperature" ? 1 : 2; } const margin = (max - min) * .18; min -= margin; max += margin; if (key === "temperature") { min = Math.min(min, 0); max = Math.max(max, 40); } if (key === "humidity") { min = Math.min(min, 0); max = Math.max(max, 100); } }
    ctx.font = "10px -apple-system,BlinkMacSystemFont,sans-serif"; ctx.lineWidth = 1; ctx.textAlign = "right"; ctx.fillStyle = "#71839b"; ctx.strokeStyle = "#b6d1ed18";
    for (let i = 0; i <= 3; i++) { const y = pad.top + h * i / 3; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); ctx.fillText(Math.round(max - (max - min) * i / 3), pad.left - 7, y + 3); }
    if (!data.length) { ctx.textAlign = "center"; ctx.fillStyle = "#71839b"; ctx.fillText("Collecting sensor history…", pad.left + w / 2, pad.top + h / 2); return; }
    const first = data[0].t, span = Math.max(1, data[data.length - 1].t - first), points = data.map(item => ({ x: pad.left + (item.t - first) / span * w, y: pad.top + (max - item[key]) / (max - min) * h, item }));
    const fill = ctx.createLinearGradient(0, pad.top, 0, pad.top + h); fill.addColorStop(0, `${color}45`); fill.addColorStop(1, `${color}00`); ctx.beginPath(); ctx.moveTo(points[0].x, pad.top + h); points.forEach(point => ctx.lineTo(point.x, point.y)); ctx.lineTo(points[points.length - 1].x, pad.top + h); ctx.fillStyle = fill; ctx.fill();
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.stroke();
    const last = points[points.length - 1]; ctx.beginPath(); ctx.arc(last.x, last.y, 4, 0, Math.PI * 2); ctx.fillStyle = "#dff6ff"; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    canvas.__chart = { data, points, key, digits, tooltip: $(tooltipId) };
  }
  function drawAllCharts() { drawChart("temperatureChart", "temperature", "#ffab70", "tempChartLatest", "tempChartStart", "temperatureTooltip", 1); drawChart("humidityChart", "humidity", "#70cfff", "humidityChartLatest", "humidityChartStart", "humidityTooltip", 0); drawChart("lightChart", "light", "#f2c768", "lightChartLatest", "lightChartStart", "lightTooltip", 0); text("historyCount", `${history.length} samples recorded on this browser`); }
  function attachChartInteraction(canvas) { canvas.addEventListener("pointermove", event => { const chart = canvas.__chart; if (!chart || !chart.points.length) return; const rect = canvas.getBoundingClientRect(), x = (event.clientX - rect.left) * canvas.width / rect.width / (devicePixelRatio || 1); let point = chart.points.reduce((best, candidate) => Math.abs(candidate.x - x) < Math.abs(best.x - x) ? candidate : best); const tooltip = chart.tooltip; tooltip.textContent = `${time(point.item.t, true)} · ${point.item[chart.key].toFixed(chart.digits)}${chart.key === "temperature" ? "°C" : chart.key === "humidity" ? "%" : " ADC"}`; tooltip.style.display = "block"; tooltip.style.left = `${Math.min(Math.max(point.x - 40, 4), canvas.clientWidth - tooltip.offsetWidth - 4)}px`; tooltip.style.top = `${Math.max(point.y - 35, 4)}px`; }); canvas.addEventListener("pointerleave", () => { const chart = canvas.__chart; if (chart) chart.tooltip.style.display = "none"; }); }
  function updateSafetyAlert(status) {
    const flame = status.flameMonitoringEnabled === true && status.flameDetected === true, vibration = status.vibrationMonitoringEnabled === true && status.vibrationDetected === true, reasons = [];
    if (flame) reasons.push("Flame sensor active"); if (vibration) reasons.push("Vibration detected"); const triggered = reasons.length > 0, key = reasons.slice().sort().join("|");
    $("alertBanner").classList.toggle("hidden", !triggered); if (triggered) { text("alertBannerTitle", flame ? "Flame detection alert" : "Vibration alert"); text("alertBannerText", reasons.join(" · ")); }
    if (triggered && (!alertActive || key !== activeAlertKey)) {
      alertActive = true; alertAcknowledged = false; activeAlertKey = key; lastFocusedElement = document.activeElement; $("alertOverlay").classList.remove("hidden"); text("overlayTitle", flame && vibration ? "Multiple safety alerts" : flame ? "Potential flame detected" : "Vibration detected"); text("overlayDescription", flame ? "The flame sensor input is active. Treat this as potentially serious and check the area safely." : "The vibration sensor detected recent movement. Check the location and surrounding area."); text("overlayDetails", reasons.join(" • ")); text("overlayStatus", "Alert remains active while a monitored safety input is triggered."); addEvent("Safety alert triggered", reasons.join(" · "), "alert"); if (navigator.vibrate) navigator.vibrate([250, 120, 250]); $("acknowledgeAlertButton").focus();
    } else if (!triggered && alertActive) { alertActive = false; activeAlertKey = ""; $("alertOverlay").classList.add("hidden"); addEvent("Safety alert cleared", "Safety sensor inputs returned to normal.", "good"); if (!alertAcknowledged) toast("Safety input returned to normal"); if (lastFocusedElement) lastFocusedElement.focus(); }
    else if (triggered && alertActive && !alertAcknowledged) $("alertOverlay").classList.remove("hidden");
  }
  function acknowledgeAlert() { alertAcknowledged = true; $("alertOverlay").classList.add("hidden"); text("overlayStatus", "Acknowledged. The warning stays visible until the sensor returns to normal."); toast("Alert acknowledged — sensor remains monitored"); }

  Object.values(settings).forEach(item => $(item.input).addEventListener("change", event => changeSensor(item.field, event.target.checked)));
  ["temperatureChart", "humidityChart", "lightChart"].forEach(id => attachChartInteraction($(id)));
  $("historyRange").addEventListener("change", drawAllCharts);
  $("clearHistoryButton").addEventListener("click", () => { history = []; save(HISTORY_KEY, history); drawAllCharts(); addEvent("History cleared", "Stored chart samples were removed from this browser."); toast("Sensor history cleared"); });
  $("clearEventsButton").addEventListener("click", () => { events = []; save(EVENTS_KEY, events); renderEvents(); toast("Event log cleared"); });
  $("reviewAlertButton").addEventListener("click", () => { if (alertActive) { $("alertOverlay").classList.remove("hidden"); $("acknowledgeAlertButton").focus(); } });
  $("acknowledgeAlertButton").addEventListener("click", acknowledgeAlert);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && alertActive) acknowledgeAlert(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshStatus(); });
  window.addEventListener("resize", () => requestAnimationFrame(drawAllCharts));
  text("todayLabel", new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }).toUpperCase()); renderEvents(); drawAllCharts(); refreshStatus(); setInterval(refreshStatus, POLL_MS);
})();
