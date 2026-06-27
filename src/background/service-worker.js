// src/background/service-worker.js

import { MessageType, EngineState } from "../shared/enums.js";
import { validateSignalConfig, isValidMessageType } from "../shared/validators.js";
import { logger } from "../shared/logger.js";
import { computeNext, initialEngineState, resetEngine } from "../engine/signal-engine.js";
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
  sendToTab,
  sendToTabWithRetry,
  notifyPopup,
  requestContextOnTab,
  startStreamOnTab,
  stopStreamOnTab,
  probeChartOnActiveTab
} from "./message-bus.js";

const MIN_PRICE_INTERVAL_MS = 500;
const MIN_CANDLE_INTERVAL_MS = 1200;
const STALE_SESSION_MS = 60_000;

const lastPriceTsByTab = new Map();
const lastCandleTsByTab = new Map();
const debouncedPriceByTab = new Map();

function hashConfig(cfg) {
  return JSON.stringify(cfg ?? {});
}

async function getActiveHivaexTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error("NO_ACTIVE_TAB");
  const session = await getSessionState();
  if (typeof session?.tabId === "number") return session.tabId;
  return tab.id;
}

function safeSend(sendResponse, payload) {
  try {
    if (typeof sendResponse === "function") sendResponse(payload);
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
    safeSend(sendResponse, { ok: false, error: "UNKNOWN_MESSAGE_TYPE" });
    return true;
  }

  (async () => {
    switch (type) {
      case MessageType.GET_STATUS: {
        const [session, config, logs0] = await Promise.all([getSessionState(), getSignalConfig(), getTradeLogs()]);
        safeSend(sendResponse, { ok: true, type, data: { session, config, logs: logs0.slice(-50) } });
        break;
      }
      case MessageType.GET_LOGS: {
        const logs = await getTradeLogs();
        safeSend(sendResponse, { ok: true, type, data: logs.slice(-200) });
        break;
      }
      case MessageType.SAVE_SIGNAL_CONFIG: {
        const validation = validateSignalConfig(message?.payload ?? {});
        if (!validation.valid) {
          safeSend(sendResponse, { ok: false, error: "INVALID_SIGNAL_CONFIG", details: validation.errors });
          break;
        }
        await setSignalConfig(validation.value);
        safeSend(sendResponse, { ok: true, type, data: validation.value });
        break;
      }
      case MessageType.START_MONITORING: {
        const probe = await probeChartOnActiveTab();
        if (!probe.ok || !probe.tabId) {
          safeSend(sendResponse, { ok: false, error: probe.error ?? "PROBE_FAILED" });
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
        safeSend(sendResponse, { ok: true, type, data: next });
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
        safeSend(sendResponse, { ok: true, type, data: next });
        break;
      }
      case MessageType.EXPORT_CSV: {
        const logs = await getTradeLogs();
        const { logsToCsv } = await import("./csv-export.js");
        const csv = logsToCsv(logs);
        safeSend(sendResponse, {
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
      case MessageType.CHART_DETECTED: {
        safeSend(sendResponse, { ok: true, type });
        break;
      }
      case MessageType.PLATFORM_INFO: {
        const session = await getSessionState();
        const next = { ...session, platformName: message?.payload?.platformName ?? null, updatedAt: Date.now() };
        await setSessionState(next);
        await setLastContext({ platformName: next.platformName });
        await notifyPopup(MessageType.STATUS_UPDATE, next);
        safeSend(sendResponse, { ok: true, type });
        break;
      }
      case MessageType.SYMBOL_TIMEFRAME: {
        const session = await getSessionState();
        const next = { ...session, symbol: message?.payload?.symbol ?? null, timeframe: message?.payload?.timeframe ?? null, updatedAt: Date.now() };
        await setSessionState(next);
        await setLastContext({ symbol: next.symbol, timeframe: next.timeframe });
        await notifyPopup(MessageType.STATUS_UPDATE, next);
        safeSend(sendResponse, { ok: true, type });
        break;
      }
      case MessageType.PRICE_UPDATE: {
        const price = Number(message?.payload?.price);
        if (!Number.isFinite(price)) {
          safeSend(sendResponse, { ok: true, type, ignored: "NO_PRICE" });
          break;
        }
        const config = await getSignalConfig();

        const result = computeNext(null, config, price);
        const last = debouncedPriceByTab.get(sender.tab?.id) ?? { price: null, ts: 0 };
        if (last.price === price && Date.now() - last.ts < 800) {
          safeSend(sendResponse, { ok: true, type, ignored: "PRICE_DEBOUNCED" });
          break;
        }
        debouncedPriceByTab.set(sender.tab?.id, { price, ts: Date.now() });

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
            timeframe: message?.payload?.timeframe ?? null
          });
          await notifyPopup(MessageType.TRADE_EVENT, { transition: result.event, state: result.state });

          if (result.state === EngineState.ENTRY_TRIGGER && config.autoExecute) {
            const side = price > (result.linePrice ?? price) ? "BUY" : "SELL";
            const tabId = sender?.tab?.id ?? (await getSessionState())?.tabId;
            if (tabId) {
              const orderRes = await sendToTab(tabId, { type: MessageType.PLACE_ORDER, payload: { side, volume: config.lotSize ?? 1 } });
              await appendTradeLog({
                event: "AUTO_ORDER",
                side,
                lotSize: config.lotSize ?? 1,
                price,
                result: orderRes,
                ts: Date.now()
              });
              await notifyPopup(MessageType.TRADE_EVENT, { event: "AUTO_ORDER", side, lotSize: config.lotSize });
            }
          }
        }
        safeSend(sendResponse, { ok: true, type, data: result });
        break;
      }
      case MessageType.CANDLE_UPDATE: {
        const nowTs = Date.now();
        const prevTs = lastCandleTsByTab.get(sender.tab?.id) ?? 0;
        if (nowTs - prevTs < MIN_CANDLE_INTERVAL_MS) {
          safeSend(sendResponse, { ok: true, type, ignored: "CANDLE_DEBOUNCED" });
          break;
        }
        lastCandleTsByTab.set(sender.tab?.id, nowTs);

        const config = await getSignalConfig();
        const p = message?.payload ?? {};
        computeNext(null, config, null, {
          open: Number(p.open),
          high: Number(p.high),
          low: Number(p.low),
          close: Number(p.close)
        });

        safeSend(sendResponse, { ok: true, type });
        break;
      }
      case MessageType.STREAM_ERROR: {
        await appendTradeLog({
          event: "STREAM_ERROR",
          payload: message?.payload ?? {},
          symbol: message?.payload?.symbol ?? null,
          timeframe: message?.payload?.timeframe ?? null
        });
        await notifyPopup(MessageType.TRADE_EVENT, { level: "error", details: message?.payload ?? {} });
        safeSend(sendResponse, { ok: true, type });
        break;
      }
      case MessageType.GET_BROKER_STATUS: {
        const tabId = await getActiveHivaexTabId();
        const response = await sendToTab(tabId, { type: MessageType.GET_BROKER_STATUS });
        safeSend(sendResponse, { ok: true, ...(response?.data ?? {}) });
        break;
      }
      case MessageType.PLACE_ORDER: {
        const tabId = await getActiveHivaexTabId();
        const response = await sendToTab(tabId, { type: MessageType.PLACE_ORDER, payload: message?.payload });
        safeSend(sendResponse, { ok: response?.ok, ...(response?.data ?? {}) });
        break;
      }
      case MessageType.SET_TPSL: {
        const tabId = await getActiveHivaexTabId();
        const response = await sendToTab(tabId, { type: MessageType.SET_TPSL, payload: message?.payload });
        safeSend(sendResponse, { ok: response?.ok, ...(response?.data ?? {}) });
        break;
      }
      default: {
        safeSend(sendResponse, { ok: false, error: "UNHANDLED_MESSAGE_TYPE" });
      }
    }
  })().catch((err) => {
    logger.error("service-worker", "Unhandled onMessage error", err);
    safeSend(sendResponse, { ok: false, error: "INTERNAL_ERROR", details: String(err?.message ?? err) });
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

setInterval(async () => {
  try {
    const s = await getSessionState();
    if (!s?.monitoring || !s?.updatedAt) return;
    if (Date.now() - s.updatedAt > STALE_SESSION_MS) {
      scheduleReconnect(() => recoverIfNeeded());
    }
  } catch (err) {
    logger.warn("service-worker", "watchdog failed", err);
  }
}, 15_000);
