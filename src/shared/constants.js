// src/shared/constants.js

import { Direction, EngineState, EntryMode } from "./enums.js";

export const STORAGE_KEYS = Object.freeze({
  SIGNAL_CONFIG: "signalConfig",
  SESSION: "sessionState",
  TRADE_LOGS: "tradeLogs",
  LAST_CONTEXT: "lastContext",
  UI_PREFERENCES: "uiPreferences"
});

export const DEFAULT_SIGNAL_CONFIG = Object.freeze({
  angleDeg: 0,
  anchorIndex: 0,
  anchorPrice: 0,
  direction: Direction.AUTO,
  atrPeriod: 14,
  atrMultiplier: 1.0,
  entryMode: EntryMode.BREAKOUT_RETEST,
  takeProfitRR: 2,
  stopLossATR: 1
});

export const DEFAULT_SESSION_STATE = Object.freeze({
  engineState: EngineState.IDLE,
  monitoring: false,
  tabId: null,
  platformName: null,
  symbol: null,
  timeframe: null,
  lastPrice: null,
  updatedAt: null
});
