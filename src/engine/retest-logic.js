// src/engine/retest-logic.js

import { EngineState } from "../shared/enums.js";
import { Direction } from "../shared/enums.js";
import { buildZone } from "./zone-model.js";

export function evaluateRetest({ state, config, price }) {
  if (state !== EngineState.WAIT_RETEST || price === null || price === undefined || Number.isNaN(Number(price))) {
    return { shouldTransition: false };
  }

  const direction = resolveDirection(config);
  const trendlinePrice = getTrendlinePrice(config, price);
  const zone = buildZone(trendlinePrice, 0, 1);

  if (price >= zone.lower && price <= zone.upper) {
    return { shouldTransition: true, next: EngineState.ENTRY_TRIGGER, event: "RETEST_CONFIRMED", price };
  }

  const oppositeBreak =
    (direction === Direction.LONG && price < zone.lower) ||
    (direction === Direction.SHORT && price > zone.upper);

  if (oppositeBreak) {
    return { shouldTransition: true, next: EngineState.WAIT_BREAKOUT, event: "FALSE_BREAKOUT", price };
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
