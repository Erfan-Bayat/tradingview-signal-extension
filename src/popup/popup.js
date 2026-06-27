// src/popup/popup.js

import { MessageType } from "../shared/enums.js";
import { DEFAULT_SIGNAL_CONFIG } from "../shared/constants.js";

const $ = (id) => document.getElementById(id);

const els = {
  statusText: $("statusText"),
  platform: $("platform"),
  symbol: $("symbol"),
  timeframe: $("timeframe"),
  engineState: $("engineState"),
  lastPrice: $("lastPrice"),
  brokerStatus: $("brokerStatus"),
  angleDeg: $("angleDeg"),
  anchorIndex: $("anchorIndex"),
  anchorPrice: $("anchorPrice"),
  direction: $("direction"),
  atrPeriod: $("atrPeriod"),
  atrMultiplier: $("atrMultiplier"),
  entryMode: $("entryMode"),
  takeProfitRR: $("takeProfitRR"),
  stopLossATR: $("stopLossATR"),
  inputVolume: $("inputVolume"),
  inputTp: $("inputTp"),
  inputSl: $("inputSl"),
  autoExecute: $("autoExecute"),
  lotSize: $("lotSize"),
  logs: $("logs"),
  angleDegDisplay: $("angleDegDisplay"),
  anchorIndexDisplay: $("anchorIndexDisplay"),
  anchorPriceDisplay: $("anchorPriceDisplay"),
  engineModeDisplay: $("engineModeDisplay"),
  saveBtn: $("saveBtn"),
  startBtn: $("startBtn"),
  stopBtn: $("stopBtn"),
  refreshBtn: $("refreshBtn"),
  exportBtn: $("exportBtn"),
  refreshBrokerBtn: $("refreshBrokerBtn"),
  buyBtn: $("buyBtn"),
  sellBtn: $("sellBtn"),
  applyTrendBtn: $("applyTrendBtn"),
  setSlBhBtn: $("setSlBhBtn")
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
  if (els.statusText) els.statusText.textContent = session.monitoring ? "Monitoring" : "Idle";
  if (els.platform) els.platform.textContent = session.platformName ?? "-";
  if (els.symbol) els.symbol.textContent = session.symbol ?? "-";
  if (els.timeframe) els.timeframe.textContent = session.timeframe ?? "-";
  if (els.engineState) els.engineState.textContent = session.engineState ?? "-";
  if (els.lastPrice) els.lastPrice.textContent = typeof session.lastPrice === "number" ? session.lastPrice.toFixed(2) : "-";
}

function setBrokerOnline(online) {
  if (els.brokerStatus) els.brokerStatus.textContent = online ? "Online" : "Offline";
}

function loadForm(config = DEFAULT_SIGNAL_CONFIG) {
  if (!config) return;
  if (els.angleDeg) els.angleDeg.value = config.angleDeg ?? 0;
  if (els.anchorIndex) els.anchorIndex.value = config.anchorIndex ?? 0;
  if (els.anchorPrice) els.anchorPrice.value = config.anchorPrice ?? 0;
  if (els.direction) els.direction.value = config.direction ?? "AUTO";
  if (els.atrPeriod) els.atrPeriod.value = config.atrPeriod ?? 14;
  if (els.atrMultiplier) els.atrMultiplier.value = config.atrMultiplier ?? 1;
  if (els.entryMode) els.entryMode.value = config.entryMode ?? "BREAKOUT_RETEST";
  if (els.takeProfitRR) els.takeProfitRR.value = config.takeProfitRR ?? 2;
  if (els.stopLossATR) els.stopLossATR.value = config.stopLossATR ?? 1;
  if (els.lotSize) els.lotSize.value = config.lotSize ?? 1;
  if (els.autoExecute) els.autoExecute.checked = Boolean(config.autoExecute);
}

function readForm() {
  return {
    angleDeg: toNumber(els.angleDeg?.value),
    anchorIndex: toNumber(els.anchorIndex?.value, 0),
    anchorPrice: toNumber(els.anchorPrice?.value, 0),
    direction: els.direction?.value ?? "AUTO",
    atrPeriod: toNumber(els.atrPeriod?.value, 14, 1),
    atrMultiplier: toNumber(els.atrMultiplier?.value, 1, 0.01),
    entryMode: els.entryMode?.value ?? "BREAKOUT_RETEST",
    takeProfitRR: toNumber(els.takeProfitRR?.value, 2, 0.1),
    stopLossATR: toNumber(els.stopLossATR?.value, 1, 0.1),
    autoExecute: Boolean(els.autoExecute?.checked),
    lotSize: toNumber(els.lotSize?.value, 1, 1),
    confirmBeforeTrade: true
  };
}

function toNumber(raw, fallback = 0, min = -Infinity) {
  const value = Number(raw);
  return Number.isFinite(value) && value >= min ? value : fallback;
}

function renderLogs(logs = []) {
  if (!els.logs) return;
  const slice = logs.slice(-50);
  if (!slice.length) {
    els.logs.textContent = "Waiting...";
    return;
  }
  els.logs.textContent = slice
    .slice()
    .reverse()
    .map((entry) => JSON.stringify(entry))
    .join("\n");
}

async function refreshAll() {
  const [status, logs] = await Promise.all([
    runtimeSend({ type: MessageType.GET_STATUS }),
    runtimeSend({ type: MessageType.GET_LOGS })
  ]);

  setStatus(status?.data?.session);
  loadForm(status?.data?.config);
  renderLogs(logs?.data ?? []);
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

async function onBuy() {
  const volume = toNumber(els.inputVolume?.value, 0, 0);
  await runtimeSend({ type: MessageType.PLACE_ORDER, payload: { side: "BUY", volume } });
  await refreshAll();
}

async function onSell() {
  const volume = toNumber(els.inputVolume?.value, 0, 0);
  await runtimeSend({ type: MessageType.PLACE_ORDER, payload: { side: "SELL", volume } });
  await refreshAll();
}

async function onSetTpSl() {
  await runtimeSend({
    type: MessageType.SET_TPSL,
    payload: {
      takeProfit: toNumber(els.inputTp?.value),
      stopLoss: toNumber(els.inputSl?.value)
    }
  });
}

async function onRefreshBroker() {
  const res = await runtimeSend({ type: MessageType.GET_BROKER_STATUS });
  if (res?.ok) {
    setBrokerOnline(Boolean(res.loggedIn));
  }
  await refreshAll();
}

async function onApplyTrend() {
  const config = readForm();
  const res = await runtimeSend({ type: MessageType.SAVE_SIGNAL_CONFIG, payload: config });
  if (!res?.ok) alert(`Apply trend failed: ${res?.error ?? "Unknown error"}`);
  await refreshAll();
}

els.saveBtn.addEventListener("click", onSave);
els.startBtn.addEventListener("click", onStart);
els.stopBtn.addEventListener("click", onStop);
els.refreshBtn.addEventListener("click", refreshAll);
els.exportBtn.addEventListener("click", onExport);
if (els.refreshBrokerBtn) els.refreshBrokerBtn.addEventListener("click", onRefreshBroker);
if (els.buyBtn) els.buyBtn.addEventListener("click", onBuy);
if (els.sellBtn) els.sellBtn.addEventListener("click", onSell);
if (els.applyTrendBtn) els.applyTrendBtn.addEventListener("click", onApplyTrend);
if (els.setSlBhBtn) els.setSlBhBtn.addEventListener("click", onSetTpSl);

refreshAll();
