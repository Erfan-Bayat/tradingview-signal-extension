// src/content/hivaex-stream.js

import { logger } from "../shared/logger.js";

export function createHivaexStreams({ adapter }) {
  let priceWs = null;
  let candleWs = null;
  let loginCheckInterval = null;
  let lastKnownLogin = null;
  let restartScheduled = false;
  let savedCtx = null;

  function getLoginState() {
    try {
      return !!document.querySelector("a[href*='dashboard'], button") && /واریز|داشبورد|خروج/.test(document.body?.textContent || "");
    } catch {
      return false;
    }
  }

  function scheduleLoginCheck(fn) {
    if (loginCheckInterval) clearInterval(loginCheckInterval);
    loginCheckInterval = setInterval(() => {
      const loggedIn = getLoginState();
      if (loggedIn !== lastKnownLogin) {
        lastKnownLogin = loggedIn;
        fn(loggedIn);
      }
    }, 1500);
    fn(getLoginState());
  }

  return {
    start({ onPrice, onCandle, onLoginChange, onError }) {
      stopImmediate();
      savedCtx = { adapter, onPrice, onCandle, onLoginChange, onError };
      scheduleReconnect(0);
      scheduleLoginCheck((loggedIn) => {
        try { onLoginChange?.(loggedIn); } catch {}
      });
    },
    stop() {
      stopImmediate();
      if (loginCheckInterval) clearInterval(loginCheckInterval);
    }
  };

  function stopImmediate() {
    try { priceWs?.close(); } catch {}
    try { candleWs?.close(); } catch {}
    priceWs = null;
    candleWs = null;
    restartScheduled = false;
  }

  function scheduleReconnect(delayMs = 0) {
    if (restartScheduled) return;
    restartScheduled = true;
    setTimeout(() => openStreams(), delayMs);
  }

  function openStreams() {
    if (!savedCtx) { logger.warn("hivaex-stream", "openStreams: no savedCtx"); return; }
    restartScheduled = false;
    const ctx = savedCtx;
    logger.info("hivaex-stream", "Opening WebSocket streams");

    const urlPrice = "wss://hivaex.ir/ounce/ws/ounce/price/";
    priceWs = createWs(urlPrice, "price", (raw) => {
      try {
        const data = JSON.parse(raw);
        const p = parseFloat(data?.P);
        if (Number.isFinite(p)) ctx.onPrice?.(p);
      } catch (err) {
        ctx.onError?.(err);
      }
    });

    const urlCandle = "wss://hivaex.ir/ounce/ws/ounce/live-bars/";
    candleWs = createWs(urlCandle, "candle", (raw) => {
      try {
        const data = JSON.parse(raw);
        const open = parseFloat(data?.O);
        const high = parseFloat(data?.H);
        const low = parseFloat(data?.L);
        const close = parseFloat(data?.C);
        const time = data?.T ? Number(data.T) * 1000 : Date.now();
        if (![open, high, low, close].every((v) => Number.isFinite(v))) return;
        ctx.onCandle?.({ open, high, low, close, time });
      } catch (err) {
        ctx.onError?.(err);
      }
    });
  }

  function createWs(url, label, onMessage) {
    logger.info("hivaex-stream", `Creating WebSocket: ${label} → ${url}`);
    const ws = new WebSocket(url);
    ws.onerror = (event) => {
      logger.warn("hivaex-stream", `WebSocket ${label} error`, event?.type ?? event);
      try { ws.close(); } catch {}
    };
    ws.onclose = (event) => {
      logger.warn("hivaex-stream", `WebSocket ${label} closed code=${event?.code}`);
      if (label === "price") priceWs = null;
      if (label === "candle") candleWs = null;
      scheduleReconnect(3000);
    };
    ws.onopen = () => {
      const sub = label === "price" ? "0~hivaex~ounce~gold" : "0~hivaex~ounce~1m";
      logger.info("hivaex-stream", `WebSocket ${label} OPEN, subscribing: ${sub}`);
      try { ws.send(JSON.stringify({ action: "SubAdd", subs: [sub] })); } catch {}
    };
    ws.onmessage = (event) => {
      if (typeof event.data === "string") onMessage(event.data);
    };
    return ws;
  }
}
