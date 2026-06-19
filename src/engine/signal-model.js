// src/engine/signal-model.js

export function buildSignalLine({ angleDeg, anchorIndex, anchorPrice }) {
  const slope = Math.tan((angleDeg * Math.PI) / 180);
  return { slope, anchorIndex, anchorPrice };
}

export function linePriceAtIndex(line, index) {
  return line.anchorPrice + line.slope * (index - line.anchorIndex);
}
