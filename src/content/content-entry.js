// src/content/content-entry.js

import { MessageType } from "../shared/enums.js";
import { logger } from "../shared/logger.js";
import { detectTradingViewPresence } from "./tv-detector.js";
import { selectAdapter } from "../adapters/adapter-registry.js";
import { createContextReconciler } from "./context-reconciler.js";
import { createPriceStream } from "./price-stream.js";
import { createCandleStream } from "./candle-stream.js";

let activeAdapter = null;
let priceStream = null;
let candleStream = null;
let streamActive = false;
let lastContextPublishTs = 0;
const MIN_CONTEXT_INTERVAL_MS = 1000;

const reconciler = createContextReconciler({ minIntervalMs: 1200 });

function withLastError(contextLabel) {
  if (chrome.runtime.lastError) {
    logger.warn("content-entry", `${contextLabel}: ${chrome.runtime.lastError.message}`);
    return true;
  }
  return false;
}

function sendToBackground(message, callback = () => {}) {
  chrome.runtime.sendMessage(message, (response) => {
    if (withLastError(`runtime.sendMessage(${message.type})`)) return callback(null);
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
  const c = getCurrentContext();
  const next = {
    symbol: c.symbol,
    timeframe: c.timeframe,
    platformName: c.platformName
  };

  if (!force && now - lastContextPublishTs < MIN_CONTEXT_INTERVAL_MS) return c;
  if (!force && !reconciler.shouldEmit(next)) return c;

  sendToBackground({
    type: MessageType.PLATFORM_INFO,
    payload: {
      platformName: c.platformName,
      platformSource: c.platformSource,
      adapterId: c.adapter.constructor.id,
      pageUrl: window.location.href
    }
  });

  sendToBackground({
    type: MessageType.SYMBOL_TIMEFRAME,
    payload: {
      symbol: c.symbol,
      timeframe: c.timeframe,
      symbolSource: c.symbolSource,
      timeframeSource: c.timeframeSource,
      adapterId: c.adapter.constructor.id
    }
  });

  reconciler.commit(next);
  lastContextPublishTs = now;
  return c;
}


function startStream() {
  if (streamActive) return;
  streamActive = true;

  const adapter = ensureAdapter();
  priceStream = createPriceStream({ adapter, intervalMs: 1000 });
  candleStream = createCandleStream({ adapter, intervalMs: 2000 });

  priceStream.start(({ price, ts }) => {
    const c = publishContext(false);
    sendToBackground({
      type: MessageType.PRICE_UPDATE,
      payload: {
        price,
        symbol: c.symbol,
        timeframe: c.timeframe,
        adapterId: adapter.constructor.id,
        ts
      }
    });
  });

  candleStream.start((candle) => {
    const c = publishContext(false);
    sendToBackground({
      type: MessageType.CANDLE_UPDATE,
      payload: {
        ...candle,
        symbol: c.symbol,
        timeframe: c.timeframe,
        adapterId: adapter.constructor.id
      }
    });
  });
}

function stopStream() {
  streamActive = false;
  priceStream?.stop();
  candleStream?.stop();
  priceStream = null;
  candleStream = null;
}

function teardownAdapter() {
  if (activeAdapter) activeAdapter.destroy();
  activeAdapter = null;
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
      startStream();
      sendResponse({ ok: true });
      return true;
    case MessageType.STOP_STREAM:
      stopStream();
      teardownAdapter();
      sendResponse({ ok: true });
      return true;
    default:
      return false;
  }
});

(() => {
  const detection = detectTradingViewPresence(document);
  if (detection.detected) {
    ensureAdapter();
    sendToBackground({ type: MessageType.CHART_DETECTED, payload: detection });
    publishContext(true);
  }
})();
