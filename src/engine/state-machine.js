// src/engine/state-machine.js

import { EngineState, Direction, EntryMode } from "../shared/enums.js";

export function resolveDirection(configDirection, autoDirectionFromSlope) {
  if (configDirection === Direction.AUTO) return autoDirectionFromSlope;
  return configDirection;
}

export function nextState(ctx) {
  const {
    state,
    direction,
    entryMode,
    price,
    zone,
    trade
  } = ctx;

  const breaksUp = price > zone.upper;
  const breaksDown = price < zone.lower;
  const inZone = price >= zone.lower && price <= zone.upper;

  if (state === EngineState.IDLE) return EngineState.WAIT_BREAKOUT;

  if (state === EngineState.WAIT_BREAKOUT) {
    if (direction === Direction.LONG && breaksUp) {
      return entryMode === EntryMode.BREAKOUT_ONLY ? EngineState.ENTRY_TRIGGER : EngineState.WAIT_RETEST;
    }
    if (direction === Direction.SHORT && breaksDown) {
      return entryMode === EntryMode.BREAKOUT_ONLY ? EngineState.ENTRY_TRIGGER : EngineState.WAIT_RETEST;
    }
    return state;
  }

  if (state === EngineState.WAIT_RETEST) {
    if (inZone) return EngineState.ENTRY_TRIGGER;
    const invalid =
      (direction === Direction.LONG && breaksDown) ||
      (direction === Direction.SHORT && breaksUp);
    if (invalid) return EngineState.FALSE_BREAKOUT;
    return state;
  }

  if (state === EngineState.ENTRY_TRIGGER) return EngineState.TRADE_ACTIVE;

  if (state === EngineState.TRADE_ACTIVE && trade) {
    if (direction === Direction.LONG) {
      if (price >= trade.takeProfit) return EngineState.TP_HIT;
      if (price <= trade.stopLoss) return EngineState.SL_HIT;
    } else {
      if (price <= trade.takeProfit) return EngineState.TP_HIT;
      if (price >= trade.stopLoss) return EngineState.SL_HIT;
    }
    return state;
  }

  return state;
}
