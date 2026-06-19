// src/engine/atr-calculator.js

export function trueRange(curr, prevClose) {
  if (!curr) return null;
  const h = curr.high;
  const l = curr.low;
  if (prevClose == null) return Math.abs(h - l);
  return Math.max(Math.abs(h - l), Math.abs(h - prevClose), Math.abs(l - prevClose));
}

export function calculateATR(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < 2) return null;
  const trs = [];
  for (let i = 0; i < candles.length; i++) {
    const prevClose = i > 0 ? candles[i - 1].close : null;
    const tr = trueRange(candles[i], prevClose);
    if (tr != null) trs.push(tr);
  }
  if (trs.length < period) return null;
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}
