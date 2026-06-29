// src/content/content-entry.js

import { MessageType } from "../shared/enums.js";
import { logger } from "../shared/logger.js";
import { detectTradingViewPresence } from "./tv-detector.js";
import { selectAdapter } from "../adapters/adapter-registry.js";
import { createContextReconciler } from "./context-reconciler.js";
import { createHivaexStreams } from "./hivaex-stream.js";
import { createBrokerBridge } from "./broker-bridge.js";

let activeAdapter = null;
let streamActive = false;
let lastContextPublishTs = 0;
const MIN_CONTEXT_INTERVAL_MS = 1000;

const reconciler = createContextReconciler({ minIntervalMs: 1200 });
const configStore = { value: null };
let brokerBridge = null;

function withLastError(contextLabel) {
  if (chrome.runtime.lastError) {
    logger.warn("content-entry", `${contextLabel}: ${chrome.runtime.lastError.message}`);
    return true;
  }
  return false;
}

function sendToBackground(message, callback = () => {}) {
  chrome.runtime.sendMessage(message, (response) => {
    if (withLastError(`runtime.sendMessage(${message.type})`)) {
      console.error("[content-entry] send failed", message.type, chrome.runtime.lastError?.message);
      return callback(null);
    }
    callback(response ?? null);
  });
}

function ensureAdapter() {
  if (!activeAdapter) {
    activeAdapter = selectAdapter({ documentLike: document, locationLike: window.location });
    logger.info("content-entry", `Selected adapter: ${activeAdapter?.constructor?.id ?? "unknown"}`);
  }
  return activeAdapter;
}

function getCurrentContext() {
  const adapter = ensureAdapter();
  const p = adapter.getPlatformInfo();
  const c = adapter.getContext();
  return {
    adapter,
    platformName: p.platformName ?? null,
    platformSource: p.source ?? null,
    symbol: c.symbol ?? null,
    timeframe: c.timeframe ?? null,
    symbolSource: c.symbolSource ?? null,
    timeframeSource: c.timeframeSource ?? null
  };
}

function publishContext(force = false) {
  const now = Date.now();
  const ctx = getCurrentContext();
  const next = { symbol: ctx.symbol, timeframe: ctx.timeframe, platformName: ctx.platformName };
  if (!force && now - lastContextPublishTs < MIN_CONTEXT_INTERVAL_MS) return ctx;
  if (!force && !reconciler.shouldEmit(next)) return ctx;

  sendToBackground({ type: MessageType.PLATFORM_INFO, payload: { platformName: ctx.platformName, platformSource: ctx.platformSource, adapterId: ctx.adapter?.constructor?.id ?? null, pageUrl: window.location.href } });
  sendToBackground({ type: MessageType.SYMBOL_TIMEFRAME, payload: { symbol: ctx.symbol, timeframe: ctx.timeframe, symbolSource: ctx.symbolSource, timeframeSource: ctx.timeframeSource, adapterId: ctx.adapter?.constructor?.id ?? null } });
  reconciler.commit(next);
  lastContextPublishTs = now;
  return ctx;
}

function initBroker() {
  const adapter = ensureAdapter();
  if (adapter && adapter.id === "hivaex") brokerBridge = createBrokerBridge(adapter);
}

function startStream() {
  if (streamActive) { logger.info("content-entry", "startStream: already active"); return; }
  streamActive = true;
  const adapter = ensureAdapter();
  logger.info("content-entry", `startStream: adapter=${adapter?.constructor?.id}`);
  publishContext(true);

  if (adapter?.id === "hivaex") {
    const hivaex = createHivaexStreams({ adapter });
    hivaex.start({
      onPrice(price) {
        logger.debug("content-entry", `onPrice: ${price}`);
        const ctx = publishContext(false);
        sendToBackground({ type: MessageType.PRICE_UPDATE, payload: { price, symbol: ctx.symbol, timeframe: ctx.timeframe, adapterId: adapter.id, ts: Date.now() } });
      },
      onCandle(candle) {
        const ctx = publishContext(false);
        sendToBackground({ type: MessageType.CANDLE_UPDATE, payload: { ...candle, symbol: ctx.symbol, timeframe: ctx.timeframe, adapterId: adapter.id } });
      },
      onLoginChange(loggedIn) {
        sendToBackground({ type: MessageType.BROKER_STATUS, payload: { loggedIn, adapterId: adapter.id } });
      },
      onError(error) {
        sendToBackground({ type: MessageType.STREAM_ERROR, payload: { message: String(error?.message ?? error) } });
      }
    });
  }
}

function stopStream() {
  streamActive = false;
  brokerBridge = null;
}

function teardownAdapter() {
  if (activeAdapter) activeAdapter.destroy();
  activeAdapter = null;
}

function publishRetry(timeoutMs = 250) {
  setTimeout(() => { try { publishContext(true); } catch {} }, timeoutMs);
}

function handlePlaceOrder(payload = {}, sendResponse) {
  try {
    if (!brokerBridge) {
      sendResponse({ ok: false, error: "BROKER_NOT_INITIALIZED" });
      return;
    }
    sendResponse({ ok: true, result: brokerBridge.placeOrder(payload) });
  } catch (err) {
    sendResponse({ ok: false, error: String(err?.message ?? err) });
  }
}

function handleSetTPSL(payload = {}, sendResponse) {
  try {
    if (!brokerBridge) {
      sendResponse({ ok: false, error: "BROKER_NOT_INITIALIZED" });
      return;
    }
    sendResponse({ ok: true, result: brokerBridge.setTPSL(payload) });
  } catch (err) {
    sendResponse({ ok: false, error: String(err?.message ?? err) });
  }
}

function handleGetBrokerStatus(sendResponse) {
  try {
    if (!brokerBridge) {
      sendResponse({ ok: true, loggedIn: false, reason: "BROKER_NOT_READY" });
      return;
    }
    const status = brokerBridge.getStatus();
    sendResponse({ ok: true, ...status });
  } catch (err) {
    sendResponse({ ok: false, error: String(err?.message ?? err) });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message?.type) {
    case MessageType.PROBE_CHART: {
      const detection = detectTradingViewPresence(document);
      sendToBackground({ type: MessageType.CHART_DETECTED, payload: detection });
      sendResponse({ ok: true, detection });
      return true;
    }
    case MessageType.REQUEST_CONTEXT:
      publishContext(true);
      sendResponse({ ok: true });
      return true;
    case MessageType.START_STREAM:
      publishContext(true);
      initBroker();
      startStream();
      publishRetry(250);
      publishRetry(900);
      sendResponse({ ok: true });
      return true;
    case MessageType.STOP_STREAM:
      stopStream();
      teardownAdapter();
      sendResponse({ ok: true });
      return true;
    case MessageType.PLACE_ORDER:
      handlePlaceOrder(message?.payload ?? {}, sendResponse);
      return true;
    case MessageType.SET_TPSL:
      handleSetTPSL(message?.payload ?? {}, sendResponse);
      return true;
    case MessageType.GET_BROKER_STATUS:
      handleGetBrokerStatus(sendResponse);
      return true;
    default:
      return false;
  }
});

(() => {
  loadPersistedConfig();
  logger.info("content-entry", `Loaded on ${window.location.hostname}`);
  const adapter = ensureAdapter();
  logger.info("content-entry", `Selected adapter: ${adapter?.constructor?.id ?? "unknown"}`);
  const detection = detectTradingViewPresence(document);
  if (detection.detected) {
    sendToBackground({ type: MessageType.CHART_DETECTED, payload: detection });
    publishContext(true);
    publishRetry(250);
    publishRetry(900);
  }
})();

function loadPersistedConfig() {
  try {
    chrome.storage.local.get(["signalConfig"], (result) => {
      if (chrome.runtime.lastError) return;
      configStore.value = result?.signalConfig ?? null;
    });
  } catch {
    configStore.value = null;
  }
}
