// src/shared/validators.js

import { DEFAULT_SIGNAL_CONFIG } from "./constants.js";
import { Direction, EntryMode, MessageType } from "./enums.js";

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidMessageType(type) {
  return typeof type === "string" && Object.values(MessageType).includes(type);
}

export function isValidDirection(direction) {
  return Object.values(Direction).includes(direction);
}

export function isValidEntryMode(entryMode) {
  return Object.values(EntryMode).includes(entryMode);
}

export function validateSignalConfig(input = {}) {
  const merged = { ...DEFAULT_SIGNAL_CONFIG, ...input };

  const errors = [];

  if (!isFiniteNumber(merged.angleDeg)) errors.push("angleDeg must be a finite number");
  if (!Number.isInteger(merged.anchorIndex) || merged.anchorIndex < 0) errors.push("anchorIndex must be a non-negative integer");
  if (!isFiniteNumber(merged.anchorPrice) || merged.anchorPrice <= 0) errors.push("anchorPrice must be > 0");
  if (!isValidDirection(merged.direction)) errors.push("direction is invalid");
  if (!Number.isInteger(merged.atrPeriod) || merged.atrPeriod < 1) errors.push("atrPeriod must be integer >= 1");
  if (!isFiniteNumber(merged.atrMultiplier) || merged.atrMultiplier <= 0) errors.push("atrMultiplier must be > 0");
  if (!isValidEntryMode(merged.entryMode)) errors.push("entryMode is invalid");
  if (!isFiniteNumber(merged.takeProfitRR) || merged.takeProfitRR <= 0) errors.push("takeProfitRR must be > 0");
  if (!isFiniteNumber(merged.stopLossATR) || merged.stopLossATR <= 0) errors.push("stopLossATR must be > 0");

  return {
    valid: errors.length === 0,
    errors,
    value: merged
  };
}
