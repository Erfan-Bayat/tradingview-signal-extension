// src/content/candle-stream.js

function parseNumber(raw) {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function findCandleFromDom(doc = document) {
  const o = parseNumber(doc.querySelector("[data-open]")?.getAttribute("data-open"));
  const h = parseNumber(doc.querySelector("[data-high]")?.getAttribute("data-high"));
  const l = parseNumber(doc.querySelector("[data-low]")?.getAttribute("data-low"));
  const c = parseNumber(doc.querySelector("[data-close]")?.getAttribute("data-close"));

  if ([o, h, l, c].every((v) => v != null)) {
    return { open: o, high: h, low: l, close: c, time: Date.now() };
  }
  return null;
}

function sameCandle(a, b) {
  if (!a || !b) return false;
  return a.open === b.open && a.high === b.high && a.low === b.low && a.close === b.close;
}

export function createCandleStream({ adapter, intervalMs = 2000 } = {}) {
  let timer = null;
  let started = false;
  let lastCandle = null;

  function readCandle() {
    const adapterCandle = adapter?.getLastCandle?.();
    const domCandle = findCandleFromDom(document);
    return adapterCandle ?? domCandle ?? null;
  }

  return {
    start(onCandle) {
      if (started) return;
      started = true;
      timer = window.setInterval(() => {
        const candle = readCandle();
        if (!candle) return;
        if (!sameCandle(candle, lastCandle)) {
          lastCandle = candle;
          onCandle?.({ ...candle, ts: Date.now() });
        }
      }, intervalMs);
    },
    stop() {
      started = false;
      if (timer) clearInterval(timer);
      timer = null;
    }
  };
}
