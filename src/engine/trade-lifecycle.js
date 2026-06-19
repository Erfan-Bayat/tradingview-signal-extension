// src/engine/trade-lifecycle.js

import { Direction } from "../shared/enums.js";

export function buildTrade({ direction, entryPrice, zoneWidth, takeProfitRR, stopLossATR }) {
  const risk = zoneWidth * stopLossATR;
  if (direction === Direction.LONG) {
    return {
      entryPrice,
      stopLoss: entryPrice - risk,
      takeProfit: entryPrice + risk * takeProfitRR
    };
  }
  return {
    entryPrice,
    stopLoss: entryPrice + risk,
    takeProfit: entryPrice - risk * takeProfitRR
  };
}
