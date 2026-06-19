// src/content/context-reconciler.js

export function createContextReconciler({ minIntervalMs = 1200 } = {}) {
  let lastSentAt = 0;
  let last = { symbol: null, timeframe: null, platformName: null };

  function hasChanged(next) {
    return (
      next.symbol !== last.symbol ||
      next.timeframe !== last.timeframe ||
      next.platformName !== last.platformName
    );
  }

  function shouldEmit(next) {
    const now = Date.now();
    if (!hasChanged(next) && now - lastSentAt < minIntervalMs) return false;
    if (hasChanged(next)) return true;
    return now - lastSentAt >= minIntervalMs;
  }

  function commit(next) {
    last = { ...next };
    lastSentAt = Date.now();
  }

  return { shouldEmit, commit, getLast: () => ({ ...last }) };
}
