// src/shared/logger.js

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
let currentLevel = LEVELS.debug;

export function setLogLevel(level) {
  if (typeof level === "string" && level in LEVELS) currentLevel = LEVELS[level];
}

function emit(level, scope, message, ...args) {
  if (LEVELS[level] < currentLevel) return;
  const prefix = `[${scope}]`;
  const fn =
    level === "error" ? console.error :
    level === "warn" ? console.warn :
    level === "debug" ? console.debug :
    console.log;
  try {
    fn(prefix, message, ...args);
  } catch (_e) {
    // console may be unavailable in some contexts; ignore
  }
}

export const logger = Object.freeze({
  debug: (scope, message, ...args) => emit("debug", scope, message, ...args),
  info: (scope, message, ...args) => emit("info", scope, message, ...args),
  warn: (scope, message, ...args) => emit("warn", scope, message, ...args),
  error: (scope, message, ...args) => emit("error", scope, message, ...args)
});