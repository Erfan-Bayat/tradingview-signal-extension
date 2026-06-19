// src/background/service-worker.js
import { MessageType, EngineState } from "../shared/enums.js";
import { validateSignalConfig, isValidMessageType } from "../shared/validators.js";
import { logger } from "../shared/logger.js";
import { createSignalEngine } from "../engine/signal-engine.js";
import { recoverIfNeeded, scheduleReconnect, stopForTab } from "./session-manager.js";
import {
  getSessionState,
  setSessionState,
  getSignalConfig,
  setSignalConfig,
  getTradeLogs,
  appendTradeLog,
  setLastContext
} from "./storage-repo.js";
import {
  probeChartOnActiveTab,
  requestContextOnTab,
  startStreamOnTab,
  stopStreamOnTab,
  notifyPopup
} from "./message-bus.js";

let engine = null;
let engineConfigHash = null;
const recentCandlesByTab = new Map();

const lastPriceTsByTab = new Map();
const lastCandleTsByTab = new Map();

const MIN_PRICE_INTERVAL_MS = 500;
const MIN_CANDLE_INTERVAL_MS = 1200;
const STALE_SESSION_MS = 60_000;

function hashConfig(cfg) {
  return JSON.stringify(cfg ?? {});
}

async function getOrCreateEngine() {
  const config = await getSignalConfig();
  const h = hashConfig(config);
  if (!engine || engineConfigHash !== h) {
    engine = createSignalEngine(config);
    engineConfigHash = h;
  }
  return engine;
}

function sendResponseSafe(sendResponse, payload) {
  try {
    sendResponse(payload);
  } catch (err) {
    logger.warn("service-worker", "sendResponse failed", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  logger.info("service-worker", "Installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;

  if (!isValidMessageType(type)) {
    sendResponseSafe(sendResponse, { ok: false, error: "UNKNOWN_MESSAGE_TYPE" });
    return false;
  }

  (async () => {
    switch (type) {
      case MessageType.GET_STATUS: {
        const [session, config] = await Promise.all([getSessionState(), getSignalConfig()]);
        sendResponseSafe(sendResponse, { ok: true, type, data: { session, config } });
        break;
      }

      case MessageType.SAVE_SIGNAL_CONFIG: {
        const validation = validateSignalConfig(message?.payload ?? {});
        if (!validation.valid) {
          sendResponseSafe(sendResponse, { ok: false, error: "INVALID_SIGNAL_CONFIG", details: validation.errors });
          break;
        }
        await setSignalConfig(validation.value);
        engine = null;
        engineConfigHash = null;
        sendResponseSafe(sendResponse, { ok: true, type, data: validation.value });
        break;
      }

      case MessageType.START_MONITORING: {
        const probe = await probeChartOnActiveTab();
        if (!probe.ok || !probe.tabId) {
          sendResponseSafe(sendResponse, { ok: false, error: probe.error ?? "PROBE_FAILED" });
          break;
        }

        await requestContextOnTab(probe.tabId);
        await startStreamOnTab(probe.tabId);

        const session = await getSessionState();
        const next = {
          ...session,
          monitoring: true,
          tabId: probe.tabId,
          engineState: EngineState.IDLE,
          updatedAt: Date.now()
        };

        await setSessionState(next);
        await notifyPopup(MessageType.STATUS_UPDATE, next);

        sendResponseSafe(sendResponse, { ok: true, type, data: next });
        break;
      }

      case MessageType.STOP_MONITORING: {
        const session = await getSessionState();
        if (session?.tabId) await stopStreamOnTab(session.tabId);

        const next = {
          ...session,
          monitoring: false,
          updatedAt: Date.now()
        };
        await setSessionState(next);
        await notifyPopup(MessageType.STATUS_UPDATE, next);

        sendResponseSafe(sendResponse, { ok: true, type, data: next });
        break;
      }

      case MessageType.EXPORT_CSV: {
        const logs = await getTradeLogs();
        const { logsToCsv } = await import("./csv-export.js");
        const csv = logsToCsv(logs);

        sendResponseSafe(sendResponse, {
          ok: true,
          type,
          data: {
            filename: `trade-logs-${Date.now()}.csv`,
            mimeType: "text/csv;charset=utf-8",
            csv
          }
        });
        break;
      }

      case MessageType.GET_LOGS: {
        const logs = await getTradeLogs();
        sendResponseSafe(sendResponse, { ok: true, type, data: logs });
        break;
      }

      case MessageType.CHART_DETECTED: {
        sendResponseSafe(sendResponse, { ok: true, type });
        break;
      }

      case MessageType.PLATFORM_INFO: {
        const session = await getSessionState();
        const next = {
          ...session,
          platformName: message?.payload?.platformName ?? null,
          updatedAt: Date.now()
        };
        await setSessionState(next);
        await setLastContext({ platformName: next.platformName });
        await notifyPopup(MessageType.STATUS_UPDATE, next);
        sendResponseSafe(sendResponse, { ok: true, type });
        break;
      }

      case MessageType.SYMBOL_TIMEFRAME: {
        const session = await getSessionState();
        const next = {
          ...session,
          symbol: message?.payload?.symbol ?? null,
          timeframe: message?.payload?.timeframe ?? null,
          updatedAt: Date.now()
        };
        await setSessionState(next);
        await setLastContext({ symbol: next.symbol, timeframe: next.timeframe });
        await notifyPopup(MessageType.STATUS_UPDATE, next);
        sendResponseSafe(sendResponse, { ok: true, type });
        break;
      }

      case MessageType.PRICE_UPDATE: {
        const tabId = sender?.tab?.id ?? -1;
        const nowTs = Date.now();
        const prevTs = lastPriceTsByTab.get(tabId) ?? 0;
        if (nowTs - prevTs < MIN_PRICE_INTERVAL_MS) {
          sendResponseSafe(sendResponse, { ok: true, type, ignored: "PRICE_DEBOUNCED" });
          break;
        }
        lastPriceTsByTab.set(tabId, nowTs);

        const e = await getOrCreateEngine();
        const price = Number(message?.payload?.price);
        if (!Number.isFinite(price)) {
          sendResponseSafe(sendResponse, { ok: true, type, ignored: "NO_PRICE" });
          break;
        }

        const result = e.onPrice(price);
        const session = await getSessionState();
        const next = {
          ...session,
          lastPrice: price,
          engineState: result.state,
          updatedAt: Date.now()
        };

        await setSessionState(next);
        await notifyPopup(MessageType.ENGINE_STATE_UPDATE, { session: next, result });

        if (result?.event) {
          await appendTradeLog({
            event: "STATE_TRANSITION",
            transition: result.event,
            state: result.state,
            price,
            symbol: message?.payload?.symbol ?? null,
            timeframe: message?.payload?.timeframe ?? null,
            ts: Date.now()
          });

          await notifyPopup(MessageType.TRADE_EVENT, {
            transition: result.event,
            state: result.state
          });
        }

        sendResponseSafe(sendResponse, { ok: true, type, data: result });
        break;
      }

      case MessageType.CANDLE_UPDATE: {
        const tabId = sender?.tab?.id ?? -1;
        const nowTs = Date.now();
        const prevTs = lastCandleTsByTab.get(tabId) ?? 0;
        if (nowTs - prevTs < MIN_CANDLE_INTERVAL_MS) {
          sendResponseSafe(sendResponse, { ok: true, type, ignored: "CANDLE_DEBOUNCED" });
          break;
        }
        lastCandleTsByTab.set(tabId, nowTs);

        const e = await getOrCreateEngine();
        const p = message?.payload ?? {};
        const candle = {
          open: Number(p.open),
          high: Number(p.high),
          low: Number(p.low),
          close: Number(p.close),
          time: Number(p.time ?? p.ts ?? Date.now())
        };

        if ([candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) {
          e.onCandle(candle);

          if (Number.isInteger(tabId)) {
            const arr = recentCandlesByTab.get(tabId) ?? [];
            arr.push(candle);
            if (arr.length > 300) arr.shift();
            recentCandlesByTab.set(tabId, arr);
          }
        }

        sendResponseSafe(sendResponse, { ok: true, type });
        break;
      }

      case MessageType.STREAM_ERROR: {
        await appendTradeLog({
          event: "STREAM_ERROR",
          payload: message?.payload ?? {},
          symbol: message?.payload?.symbol ?? null,
          timeframe: message?.payload?.timeframe ?? null,
          ts: Date.now()
        });

        await notifyPopup(MessageType.TRADE_EVENT, {
          level: "error",
          details: message?.payload ?? {}
        });

        sendResponseSafe(sendResponse, { ok: true, type });
        break;
      }

      default: {
        sendResponseSafe(sendResponse, { ok: false, error: "UNHANDLED_MESSAGE_TYPE" });
      }
    }
  })().catch((err) => {
    logger.error("service-worker", "Unhandled error in onMessage", err);
    sendResponseSafe(sendResponse, { ok: false, error: "INTERNAL_ERROR", details: String(err?.message ?? err) });
  });

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    scheduleReconnect(async () => {
      const s = await getSessionState();
      if (!s?.monitoring) return;
      if (s.tabId !== tabId) return;
      await requestContextOnTab(tabId);
      await startStreamOnTab(tabId);
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  stopForTab(tabId).catch((err) => logger.warn("service-worker", "stopForTab failed", err));
});

chrome.runtime.onStartup.addListener(() => {
  recoverIfNeeded().catch((err) => logger.warn("service-worker", "recoverIfNeeded failed", err));
});

// Stale-session watchdog
setInterval(async () => {
  try {
    const s = await getSessionState();
    if (!s?.monitoring || !s?.updatedAt) return;
    if (Date.now() - s.updatedAt > STALE_SESSION_MS) {
      scheduleReconnect(async () => {
        await recoverIfNeeded();
      });
    }
  } catch (err) {
    logger.warn("service-worker", "watchdog failed", err);
  }
}, 15_000);
