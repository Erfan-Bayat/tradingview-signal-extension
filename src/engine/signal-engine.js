// src/engine/signal-engine.js

import { EngineState, Direction } from "../shared/enums.js";
import { buildSignalLine, linePriceAtIndex } from "./signal-model.js";
import { calculateATR } from "./atr-calculator.js";
import { buildZone } from "./zone-model.js";
import { nextState, resolveDirection } from "./state-machine.js";
import { buildTrade } from "./trade-lifecycle.js";

export function createSignalEngine(config) {
  let state = EngineState.IDLE;
  const candles = [];
  let tickIndex = 0;
  let trade = null;

  function autoDirectionFromSlope(line) {
    return line.slope >= 0 ? Direction.LONG : Direction.SHORT;
  }

  function onCandle(candle) {
    candles.push(candle);
    if (candles.length > 500) candles.shift();
  }

  function onPrice(price) {
    tickIndex += 1;

    const line = buildSignalLine(config);
    const linePrice = linePriceAtIndex(line, tickIndex);
    const atr = calculateATR(candles, config.atrPeriod);
    const zone = buildZone(linePrice, atr ?? 0, config.atrMultiplier);
    const direction = resolveDirection(config.direction, autoDirectionFromSlope(line));

    const prev = state;
    state = nextState({
      state,
      direction,
      entryMode: config.entryMode,
      price,
      zone,
      trade
    });

    if (state === EngineState.ENTRY_TRIGGER && !trade) {
      trade = buildTrade({
        direction,
        entryPrice: price,
        atr: Math.max(atr ?? 0, 0.0000001),
        takeProfitRR: config.takeProfitRR,
        stopLossATR: config.stopLossATR
      });
    }

    const event = prev !== state ? { from: prev, to: state } : null;

    return {
      state,
      direction,
      zone,
      atr,
      trade,
      event
    };
  }

  function reset() {
    state = EngineState.IDLE;
    candles.length = 0;
    tickIndex = 0;
    trade = null;
  }

  return { onCandle, onPrice, reset, getState: () => state };
}
