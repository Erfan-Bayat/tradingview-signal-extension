// src/engine/breakout-logic.js

import { EngineState } from "../shared/enums.js";
import { Direction } from "../shared/enums.js";
import { buildZone } from "./zone-model.js";

export function evaluateBreakout({ state, config, price }) {
  if (state !== EngineState.WAIT_BREAKOUT || price === null || price === undefined || Number.isNaN(Number(price))) {
    return { shouldTransition: false };
  }

  const direction = resolveDirection(config);
  const trendlinePrice = getTrendlinePrice(config, price);
  const atr = getConfigAtr(config);
  const zone = buildZone(trendlinePrice, atr, 1);

  if (direction === Direction.LONG && price >= zone.upper) {
    return { shouldTransition: true, next: EngineState.WAIT_RETEST, event: "BREAKOUT_DETECTED", price };
  }

  if (direction === Direction.SHORT && price <= zone.lower) {
    return { shouldTransition: true, next: EngineState.WAIT_RETEST, event: "BREAKOUT_DETECTED", price };
  }

  return { shouldTransition: false };
}

function resolveDirection(config) {
  if (!config || config.direction === "AUTO") return Direction.LONG;
  return config.direction;
}

function getTrendlinePrice(config, currentPrice) {
  const fallback = currentPrice;
  if (!config) return fallback;

  const anchorPrice = Number(config.anchorPrice);
  const anchorIndex = Number(config.anchorIndex);
  const angleDeg = Number(config.angleDeg) || 0;

  if (!Number.isFinite(anchorPrice) || !Number.isInteger(anchorIndex)) {
    return fallback;
  }

  const angleRad = (angleDeg * Math.PI) / 180;
  return anchorPrice + Math.tan(angleRad) * (fallback - anchorIndex);
}

function getConfigAtr(config) {
  if (!config) return 0;
  const multiplier = Number(config.atrMultiplier);
  return Number.isFinite(multiplier) ? multiplier : 0;
}
