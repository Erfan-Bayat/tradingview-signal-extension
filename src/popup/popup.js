// popup/popup.js
import { MessageType, Direction, EntryMode } from "../shared/enums.js";
import { DEFAULT_SIGNAL_CONFIG } from "../shared/constants.js";

const $ = (id) => document.getElementById(id);

const els = {
  statusText: $("statusText"),
  platform: $("platform"),
  symbol: $("symbol"),
  timeframe: $("timeframe"),
  engineState: $("engineState"),
  lastPrice: $("lastPrice"),

  angleDeg: $("angleDeg"),
  anchorIndex: $("anchorIndex"),
  anchorPrice: $("anchorPrice"),
  direction: $("direction"),
  atrPeriod: $("atrPeriod"),
  atrMultiplier: $("atrMultiplier"),
  entryMode: $("entryMode"),
  takeProfitRR: $("takeProfitRR"),
  stopLossATR: $("stopLossATR"),

  saveBtn: $("saveBtn"),
  startBtn: $("startBtn"),
  stopBtn: $("stopBtn"),
  refreshBtn: $("refreshBtn"),
  exportBtn: $("exportBtn"),

  logs: $("logs")
};

function runtimeSend(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (res) => {
      if (chrome.runtime.lastError) {
        console.warn("runtime.sendMessage:", chrome.runtime.lastError.message);
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(res ?? { ok: false });
    });
  });
}

function setStatus(session = {}) {
  els.statusText.textContent = session.monitoring ? "Monitoring" : "Idle";
  els.platform.textContent = session.platformName ?? "-";
  els.symbol.textContent = session.symbol ?? "-";
  els.timeframe.textContent = session.timeframe ?? "-";
  els.engineState.textContent = session.engineState ?? "-";
  els.lastPrice.textContent =
    typeof session.lastPrice === "number" ? String(session.lastPrice) : "-";
}

function loadForm(config = DEFAULT_SIGNAL_CONFIG) {
  els.angleDeg.value = config.angleDeg;
  els.anchorIndex.value = config.anchorIndex;
  els.anchorPrice.value = config.anchorPrice;
  els.direction.value = config.direction ?? Direction.AUTO;
  els.atrPeriod.value = config.atrPeriod;
  els.atrMultiplier.value = config.atrMultiplier;
  els.entryMode.value = config.entryMode ?? EntryMode.BREAKOUT_RETEST;
  els.takeProfitRR.value = config.takeProfitRR;
  els.stopLossATR.value = config.stopLossATR;
}

function readForm() {
  return {
    angleDeg: Number(els.angleDeg.value),
    anchorIndex: Number(els.anchorIndex.value),
    anchorPrice: Number(els.anchorPrice.value),
    direction: els.direction.value,
    atrPeriod: Number(els.atrPeriod.value),
    atrMultiplier: Number(els.atrMultiplier.value),
    entryMode: els.entryMode.value,
    takeProfitRR: Number(els.takeProfitRR.value),
    stopLossATR: Number(els.stopLossATR.value)
  };
}

function renderLogs(logs = []) {
  els.logs.textContent = logs
    .slice(-50)
    .reverse()
    .map((l) => JSON.stringify(l))
    .join("\n");
}

async function refreshAll() {
  const status = await runtimeSend({ type: MessageType.GET_STATUS });
  if (status?.ok) {
    setStatus(status.data?.session);
    loadForm(status.data?.config);
  }

  const logs = await runtimeSend({ type: MessageType.GET_LOGS });
  if (logs?.ok) renderLogs(logs.data);
}

async function onSave() {
  const payload = readForm();
  const res = await runtimeSend({ type: MessageType.SAVE_SIGNAL_CONFIG, payload });
  if (!res?.ok) alert(`Save failed: ${res?.error ?? "Unknown error"}`);
  await refreshAll();
}

async function onStart() {
  const res = await runtimeSend({ type: MessageType.START_MONITORING });
  if (!res?.ok) alert(`Start failed: ${res?.error ?? "Unknown error"}`);
  await refreshAll();
}

async function onStop() {
  const res = await runtimeSend({ type: MessageType.STOP_MONITORING });
  if (!res?.ok) alert(`Stop failed: ${res?.error ?? "Unknown error"}`);
  await refreshAll();
}

async function onExport() {
  const res = await runtimeSend({ type: MessageType.EXPORT_CSV });
  if (!res?.ok) {
    alert(`Export failed: ${res?.error ?? "Unknown error"}`);
    return;
  }

  const { csv, filename, mimeType } = res.data ?? {};
  if (!csv) {
    alert("No CSV data available.");
    return;
  }

  const blob = new Blob([csv], { type: mimeType || "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "trade-logs.csv";
  a.click();
  URL.revokeObjectURL(url);
}


chrome.runtime.onMessage.addListener((message) => {
  if (!message?.type) return;

  if (message.type === MessageType.STATUS_UPDATE) {
    setStatus(message.payload ?? {});
  } else if (message.type === MessageType.ENGINE_STATE_UPDATE) {
    setStatus(message.payload?.session ?? {});
  } else if (message.type === MessageType.TRADE_EVENT) {
    refreshAll();
  } else if (message.type === MessageType.EXPORT_READY) {
    // reserved for Step 10
  }
});

els.saveBtn.addEventListener("click", onSave);
els.startBtn.addEventListener("click", onStart);
els.stopBtn.addEventListener("click", onStop);
els.refreshBtn.addEventListener("click", refreshAll);
els.exportBtn.addEventListener("click", onExport);

refreshAll();
