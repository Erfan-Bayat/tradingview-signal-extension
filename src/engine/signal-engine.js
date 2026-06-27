// src/engine/signal-engine.js

import { EngineState } from "../shared/enums.js";
import { evaluateBreakout } from "./breakout-logic.js";
import { evaluateRetest } from "./retest-logic.js";

export function createSignalEngine(config = null) {
  const engine = {
    state: initialEngineState(),
    config: null,
    lastEvent: null,
    zone: null,
    linePrice: null,
    atr: null,
    volatilityRatio: null,
    triggerReason: null,
    htfBias: null,
    mtfScore: null,
    orderBookBias: null,
    confirmationFields: []
  };

  if (config) engine.config = config;

  return engine;
}

export function resetEngine(engine = null) {
  if (!engine) return { state: EngineState.IDLE };
  engine.state = EngineState.IDLE;
  engine.lastEvent = null;
  engine.zone = null;
  engine.linePrice = null;
  engine.atr = null;
  engine.volatilityRatio = null;
  engine.triggerReason = null;
  return engine;
}

export function initialEngineState() {
  return {
    state: EngineState.IDLE,
    config: null,
    lastEvent: null,
    zone: null,
    linePrice: null,
    atr: null,
    volatilityRatio: null,
    triggerReason: null,
    htfBias: null,
    mtfScore: null,
    orderBookBias: null,
    confirmationFields: []
  };
}

export function computeNext(engine = null, config = null, price = null, candle = null) {
  const current = engine ? { ...engine, ...engine } : initialEngineState();
  current.config = config ?? current.config;

  let hasPrice = Number.isFinite(price);
  let hasCandle = Boolean(candle);

  if (hasCandle) {
    updateCandleMetrics(current, candle);
  }

  if (hasPrice) {
    if (current.state === EngineState.IDLE) {
      current.state = EngineState.WAIT_BREAKOUT;
      current.lastEvent = "STARTED";
    }
  }

  if (!hasPrice) {
    return current;
  }

  if (current.state === EngineState.WAIT_BREAKOUT) {
    const breakoutResult = evaluateBreakout({ state: current.state, config: current.config, price, candle: current.zone });
    if (breakoutResult.shouldTransition) {
      current.state = breakoutResult.next;
      current.lastEvent = breakoutResult.event;
      current.triggerReason = "breakout";
    }
    return current;
  }

  if (current.state === EngineState.WAIT_RETEST) {
    const retestResult = evaluateRetest({ state: current.state, config: current.config, price });
    if (retestResult.shouldTransition) {
      current.state = retestResult.next;
      current.lastEvent = retestResult.event;
      current.triggerReason = retestResult.event === "RETEST_CONFIRMED" ? "retest" : "false-breakout";
      if (current.state === EngineState.WAIT_BREAKOUT) {
        current.zone = null;
        current.linePrice = null;
      }
    }
    return current;
  }

  if (current.state === EngineState.ENTRY_TRIGGER) {
    handleEntryTrigger(current, price);
    return current;
  }

  if (current.state === EngineState.TRADE_ACTIVE) {
    updateTradeState(current, price);
    return current;
  }

  return current;
}

function handleEntryTrigger(current, price) {
  const zone = current.zone;
  if (!zone) {
    current.lastEvent = "MISSING_ZONE";
    current.state = EngineState.WAIT_BREAKOUT;
    return;
  }

  const config = current.config ?? {};
  const atr = Math.max(current.atr ?? zone.atr ?? 0.001, 0.0000001);
  const risk = atr * (config.stopLossATR ?? 1);
  const direction = price > (current.linePrice ?? price) ? "LONG" : "SHORT";

  if (direction === "LONG") {
    current.stopLoss = price - risk;
    current.takeProfit = price + risk * (config.takeProfitRR ?? 2);
  } else {
    current.stopLoss = price + risk;
    current.takeProfit = price - risk * (config.takeProfitRR ?? 2);
  }
  current.entryPrice = price;
  current.tradeDirection = direction;

  current.state = EngineState.TRADE_ACTIVE;
  current.lastEvent = "ENTRY_TRIGGERED";
}

function updateTradeState(current, price) {
  if (current.takeProfit == null || current.stopLoss == null) {
    current.lastEvent = "MISSING_TP_SL";
    current.state = EngineState.WAIT_BREAKOUT;
    return;
  }

  const dir = current.tradeDirection ?? "LONG";
  if (dir === "LONG") {
    if (price >= current.takeProfit) {
      current.state = EngineState.TP_HIT;
      current.lastEvent = "TP_HIT";
    } else if (price <= current.stopLoss) {
      current.state = EngineState.SL_HIT;
      current.lastEvent = "SL_HIT";
    }
  } else {
    if (price <= current.takeProfit) {
      current.state = EngineState.TP_HIT;
      current.lastEvent = "TP_HIT";
    } else if (price >= current.stopLoss) {
      current.state = EngineState.SL_HIT;
      current.lastEvent = "SL_HIT";
    }
  }
}

function updateCandleMetrics(current, candle) {
  const config = current.config ?? buildDefaultConfig();
  current.volatilityRatio = calculateVolatilityRatio(candle);
  current.atr = calculateAtr({ config, candle });
  current.zone = calculateAdaptiveZone({ config, candle, atr: current.atr });
  current.linePrice = calculateTrendlinePrice({ config, candle });
}

function calculateVolatilityRatio(candle) {
  if (!candle) return null;
  const range = Math.max(0, candle.high - candle.low);
  return range / (candle.atr || range);
}

function calculateAtr({ config, candle }) {
  if (!candle || !candle.atr) return null;
  const multiplier = Number.isFinite(config.atrMultiplier) ? config.atrMultiplier : 1;
  return candle.atr * multiplier;
}

function calculateAdaptiveZone({ config, candle, atr }) {
  if (!Number.isFinite(atr)) return null;
  const width = atr;
  const center = candle.linePrice ?? candle.close ?? 0;
  return {
    upper: center + width,
    lower: center - width,
    center,
    width,
    atr,
    retestJitter: Math.max(width * 0.35, 0.00005)
  };
}

function calculateTrendlinePrice({ config, candle }) {
  const angleDeg = config?.angleDeg ?? 0;
  const anchorIndex = config?.anchorIndex ?? 0;
  const anchorPrice = config?.anchorPrice ?? 0;
  const slope = Math.tan((angleDeg * Math.PI) / 180);
  return anchorPrice + slope * (candle.index - anchorIndex);
}

function buildDefaultConfig() {
  return {
    angleDeg: 0,
    anchorIndex: 0,
    anchorPrice: 0,
    atrMultiplier: 1
  };
}

export function buildActiveZone({ config, price }) {
  const center = calculateTrendlinePrice({ config, candle: { index: config?.anchorIndex ?? 0, close: price } });
  const width = calculateAtr({ config, candle: { atr: 0.001 } });
  if (!Number.isFinite(center) || !Number.isFinite(width)) return null;
  return {
    upper: center + width,
    lower: center - width,
    center,
    width,
    atr: width,
    retestJitter: Math.max(width * 0.35, 0.00005)
  };
}
