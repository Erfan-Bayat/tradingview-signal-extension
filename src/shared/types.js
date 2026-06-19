// src/shared/types.js

/**
 * @typedef {Object} SignalConfig
 * @property {number} angleDeg
 * @property {number} anchorIndex
 * @property {number} anchorPrice
 * @property {"LONG"|"SHORT"|"AUTO"} direction
 * @property {number} atrPeriod
 * @property {number} atrMultiplier
 * @property {"BREAKOUT_ONLY"|"BREAKOUT_RETEST"} entryMode
 * @property {number} takeProfitRR
 * @property {number} stopLossATR
 */

/**
 * @typedef {Object} SessionState
 * @property {"IDLE"|"WAIT_BREAKOUT"|"WAIT_RETEST"|"ENTRY_TRIGGER"|"TRADE_ACTIVE"|"TP_HIT"|"SL_HIT"|"FALSE_BREAKOUT"} engineState
 * @property {boolean} monitoring
 * @property {number|null} tabId
 * @property {string|null} platformName
 * @property {string|null} symbol
 * @property {string|null} timeframe
 * @property {number|null} lastPrice
 * @property {number|null} updatedAt
 */
