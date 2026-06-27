// src/popup/form-preferences.js

export function createPreferencesForm(container) {
  const target = typeof container === "string" ? document.querySelector(container) : container;
  if (!target) return { getValues: () => ({}), setValues: () => {} };

  function getValues() {
    return {
      autoRefresh: target.querySelector('[data-field="autoRefresh"]')?.checked ?? true,
      pollIntervalMs: toInt(target.querySelector('[data-field="pollIntervalMs"]')?.value, 2000, 500)
    };
  }

  function setValues(prefs = {}) {
    const nodes = {
      autoRefresh: target.querySelector('[data-field="autoRefresh"]'),
      pollIntervalMs: target.querySelector('[data-field="pollIntervalMs"]')
    };
    if (nodes.autoRefresh) nodes.autoRefresh.checked = Boolean(prefs.autoRefresh ?? true);
    if (nodes.pollIntervalMs) nodes.pollIntervalMs.value = prefs.pollIntervalMs ?? 2000;
  }

  return { getValues, setValues };
}

function toInt(raw, fallback = 0, min = -Infinity) {
  const value = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(value) && value >= min ? value : fallback;
}
