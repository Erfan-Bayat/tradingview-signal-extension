// src/engine/zone-model.js

export function buildZone(linePrice, atr, atrMultiplier = 1) {
  const width = (atr ?? 0) * atrMultiplier;
  return {
    center: linePrice,
    upper: linePrice + width,
    lower: linePrice - width,
    width
  };
}
