"use strict";

// ---------- config (persisted per-browser only, never sent anywhere but the
// API the viewer enters) ----------

const CONFIG_KEY = "gazasafes_dashboard_config";
const THEME_KEY = "gazasafes_dashboard_theme";

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConfig(cfg) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // private browsing / storage blocked — config just won't persist across reloads
  }
}

let config = loadConfig();

// ---------- theme ----------

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode);
  else root.removeAttribute("data-theme");
}

function cycleTheme() {
  const current = localStorage.getItem(THEME_KEY) || "auto";
  const next = current === "auto" ? "light" : current === "light" ? "dark" : "auto";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
  applyTheme(next);
  document.getElementById("themeToggle").textContent = next === "light" ? "☀" : next === "dark" ? "☾" : "◐";
  rerenderAllCharts();
}

applyTheme(localStorage.getItem(THEME_KEY) || "auto");

// ---------- settings overlay ----------

const overlay = document.getElementById("settingsOverlay");
const apiBaseInput = document.getElementById("apiBaseInput");
const apiKeyInput = document.getElementById("apiKeyInput");
const connectionStatus = document.getElementById("connectionStatus");

function openSettings() {
  apiBaseInput.value = config?.apiBase ?? "";
  apiKeyInput.value = config?.apiKey ?? "";
  overlay.hidden = false;
  apiBaseInput.focus();
}
function closeSettings() {
  overlay.hidden = true;
}

document.getElementById("settingsBtn").addEventListener("click", openSettings);
document.getElementById("settingsCancel").addEventListener("click", () => {
  if (config) closeSettings();
});
document.getElementById("settingsSave").addEventListener("click", () => {
  let apiBase = apiBaseInput.value.trim().replace(/\/$/, "");
  const apiKey = apiKeyInput.value.trim();
  if (!apiBase || !apiKey) return;
  if (!/^https?:\/\//i.test(apiBase)) apiBase = `http://${apiBase}`;
  try {
    new URL(apiBase);
  } catch {
    showError("API base URL doesn't look valid.");
    return;
  }
  config = { apiBase, apiKey };
  saveConfig(config);
  closeSettings();
  clearError();
  updateConnectionStatus();
  refresh();
});

function updateConnectionStatus() {
  connectionStatus.textContent = config ? new URL(config.apiBase).host : "not connected";
}

// ---------- date range ----------

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");
const presetButtons = document.querySelectorAll(".preset-btn");

let range = { start: null, end: null };

function setPreset(days) {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  range = { start: toDateStr(start), end: toDateStr(end) };
  startInput.value = range.start;
  endInput.value = range.end;
  presetButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.preset === String(days)));
}

presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setPreset(Number(btn.dataset.preset));
    resetSessionsPage();
    refresh();
  });
});

document.getElementById("applyRange").addEventListener("click", () => {
  if (!startInput.value || !endInput.value) return;
  range = { start: startInput.value, end: endInput.value };
  presetButtons.forEach((b) => b.classList.remove("is-active"));
  resetSessionsPage();
  refresh();
});

setPreset(7);

// ---------- API ----------

const errorBanner = document.getElementById("errorBanner");

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}
function clearError() {
  errorBanner.hidden = true;
}

async function apiGet(path, params) {
  if (!config) throw new Error("not configured");
  const url = new URL(config.apiBase + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${config.apiKey}` } });
  if (res.status === 401) {
    showError("API key rejected — check connection settings.");
    openSettings();
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `request failed (${res.status})`);
  }
  return res.json();
}

// ---------- chart theming helpers ----------

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function baseScales(extra = {}) {
  return {
    x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 11 } }, ...extra.x },
    y: {
      grid: { color: cssVar("--gridline"), drawTicks: false },
      border: { display: false },
      ticks: { color: cssVar("--text-muted"), font: { size: 11 }, precision: 0 },
      beginAtZero: true,
      ...extra.y,
    },
  };
}

function tooltipTheme() {
  return {
    enabled: true,
    backgroundColor: cssVar("--surface-1"),
    titleColor: cssVar("--text-secondary"),
    bodyColor: cssVar("--text-primary"),
    borderColor: cssVar("--border"),
    borderWidth: 1,
    padding: 10,
    displayColors: false,
    titleFont: { size: 11, weight: "normal" },
    bodyFont: { size: 13, weight: "600" },
  };
}

// chart registry so we can destroy/recreate on theme change and table toggles
const charts = {};
const lastData = {};

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function rerenderAllCharts() {
  if (lastData.pageviews) renderPageviews(lastData.pageviews);
  if (lastData.topPages) renderTopPages(lastData.topPages);
  if (lastData.clickEvents) renderClickEvents(lastData.clickEvents);
  if (lastData.trafficSources) renderTrafficSources(lastData.trafficSources);
}

// ---------- table toggle ----------

document.querySelectorAll(".table-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    const showingTable = !target.hidden;
    target.hidden = showingTable;
    btn.textContent = showingTable ? "View as table" : "View as chart";
  });
});

function renderTable(containerId, columns, rows) {
  const container = document.getElementById(containerId);
  container.textContent = "";
  const table = document.createElement("table");
  table.className = "data-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (col.num) th.style.textAlign = "right";
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const col of columns) {
      const td = document.createElement("td");
      if (col.num) td.className = "num";
      td.textContent = row[col.key] ?? "–";
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

// ---------- renderers ----------

function renderPageviews(data) {
  lastData.pageviews = data;
  const total = data.data.reduce((sum, r) => sum + r.pageviews, 0);
  document.getElementById("kpiPageviews").textContent = total.toLocaleString();

  destroyChart("pageviews");
  const ctx = document.getElementById("pageviewsChart");
  charts.pageviews = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.data.map((r) => r.date),
      datasets: [
        {
          data: data.data.map((r) => r.pageviews),
          borderColor: cssVar("--series-1"),
          backgroundColor: cssVar("--series-1-wash"),
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: cssVar("--series-1"),
          pointBorderColor: cssVar("--surface-1"),
          pointBorderWidth: 2,
          fill: true,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltipTheme(), callbacks: { label: (item) => `${item.raw.toLocaleString()} pageviews` } },
      },
      scales: baseScales(),
    },
  });

  renderTable("pageviewsTable", [
    { key: "date", label: "Date" },
    { key: "pageviews", label: "Pageviews", num: true },
  ], data.data);
}

function horizontalBarChart(canvasId, labels, values, labelForTooltip) {
  return new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: cssVar("--series-1"),
          borderRadius: { topRight: 4, bottomRight: 4, topLeft: 0, bottomLeft: 0 },
          maxBarThickness: 24,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltipTheme(), callbacks: labelForTooltip ? { label: labelForTooltip } : undefined },
      },
      scales: {
        x: {
          grid: { color: cssVar("--gridline"), drawTicks: false },
          border: { display: false },
          ticks: { color: cssVar("--text-muted"), font: { size: 11 }, precision: 0 },
          beginAtZero: true,
        },
        y: { grid: { display: false }, ticks: { color: cssVar("--text-primary"), font: { size: 11 } } },
      },
    },
  });
}

function renderTopPages(data) {
  lastData.topPages = data;
  destroyChart("topPages");
  const rows = data.data;
  charts.topPages = horizontalBarChart(
    "topPagesChart",
    rows.map((r) => r.url || r.page_id.slice(0, 8)),
    rows.map((r) => r.pageviews),
    (item) => `${item.raw.toLocaleString()} pageviews`,
  );
  charts.topPages.canvas.parentElement.style.height = `${Math.max(120, rows.length * 32 + 40)}px`;
  charts.topPages.resize();

  renderTable("topPagesTable", [
    { key: "url", label: "Page" },
    { key: "title", label: "Title" },
    { key: "pageviews", label: "Pageviews", num: true },
  ], rows);
}

function renderClickEvents(data) {
  lastData.clickEvents = data;
  destroyChart("clickEvents");
  const rows = data.data;
  charts.clickEvents = horizontalBarChart(
    "clickEventsChart",
    rows.map((r) => r.click_target || "(none)"),
    rows.map((r) => r.count),
    (item) => `${item.raw.toLocaleString()} clicks`,
  );
  charts.clickEvents.canvas.parentElement.style.height = `${Math.max(120, rows.length * 32 + 40)}px`;
  charts.clickEvents.resize();

  renderTable("clickEventsTable", [
    { key: "click_target", label: "Click target" },
    { key: "count", label: "Count", num: true },
  ], rows);
}

function renderTrafficSources(data) {
  lastData.trafficSources = data;
  const totalSessions = data.data.reduce((sum, r) => sum + r.sessions, 0);
  destroyChart("trafficSources");
  const rows = data.data;
  charts.trafficSources = horizontalBarChart(
    "trafficSourcesChart",
    rows.map((r) => r.source),
    rows.map((r) => r.sessions),
    (item) => {
      const pct = totalSessions ? Math.round((item.raw / totalSessions) * 100) : 0;
      return `${item.raw.toLocaleString()} sessions (${pct}%)`;
    },
  );
  charts.trafficSources.canvas.parentElement.style.height = `${Math.max(120, rows.length * 32 + 40)}px`;
  charts.trafficSources.resize();

  renderTable("trafficSourcesTable", [
    { key: "source", label: "Source" },
    { key: "sessions", label: "Sessions", num: true },
  ], rows);
}

// ---------- sessions (paginated table + summary) ----------

let sessionsPagination = { limit: 20, offset: 0 };

function resetSessionsPage() {
  sessionsPagination.offset = 0;
}

function formatDuration(seconds) {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

async function loadSessions() {
  const data = await apiGet("/v1/reports/sessions", {
    start_date: range.start,
    end_date: range.end,
    limit: sessionsPagination.limit,
    offset: sessionsPagination.offset,
  });

  document.getElementById("kpiSessions").textContent = data.summary.total_sessions.toLocaleString();
  document.getElementById("kpiDuration").textContent = formatDuration(data.summary.avg_duration_seconds);

  renderTable("sessionsTable", [
    { key: "session_id", label: "Session" },
    { key: "first_seen", label: "First seen" },
    { key: "device_type", label: "Device" },
    { key: "country", label: "Country" },
  ], data.data.map((r) => ({
    ...r,
    session_id: r.session_id.slice(0, 8),
    first_seen: new Date(r.first_seen).toLocaleString(),
  })));

  const { limit, offset } = data.pagination;
  const total = data.summary.total_sessions;
  const shownEnd = Math.min(offset + limit, total);
  document.getElementById("sessionsPageInfo").textContent =
    total === 0 ? "No sessions in range" : `${offset + 1}–${shownEnd} of ${total}`;
  document.getElementById("sessionsPrev").disabled = offset === 0;
  document.getElementById("sessionsNext").disabled = shownEnd >= total;
}

document.getElementById("sessionsPrev").addEventListener("click", () => {
  sessionsPagination.offset = Math.max(0, sessionsPagination.offset - sessionsPagination.limit);
  loadSessions().catch((err) => showError(err.message));
});
document.getElementById("sessionsNext").addEventListener("click", () => {
  sessionsPagination.offset += sessionsPagination.limit;
  loadSessions().catch((err) => showError(err.message));
});

// ---------- refresh ----------

document.getElementById("themeToggle").textContent =
  (localStorage.getItem(THEME_KEY) || "auto") === "light" ? "☀" : (localStorage.getItem(THEME_KEY) || "auto") === "dark" ? "☾" : "◐";
document.getElementById("themeToggle").addEventListener("click", cycleTheme);

const app = document.getElementById("app");

async function refresh() {
  if (!config) {
    openSettings();
    return;
  }
  clearError();
  app.classList.add("is-loading");
  try {
    const [pageviews, topPages, clickEvents, trafficSources] = await Promise.all([
      apiGet("/v1/reports/pageviews", { start_date: range.start, end_date: range.end }),
      apiGet("/v1/reports/top-pages", { start_date: range.start, end_date: range.end, limit: 10 }),
      apiGet("/v1/reports/click-events", { start_date: range.start, end_date: range.end }),
      apiGet("/v1/reports/traffic-sources", { start_date: range.start, end_date: range.end }),
    ]);
    renderPageviews(pageviews);
    renderTopPages(topPages);
    renderClickEvents(clickEvents);
    renderTrafficSources(trafficSources);
    await loadSessions();
  } catch (err) {
    if (err.message !== "unauthorized") showError(err.message || "failed to load report data");
  } finally {
    app.classList.remove("is-loading");
  }
}

updateConnectionStatus();
if (!config) openSettings();
else refresh();
