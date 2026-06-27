// src/popup/form-signal.js

export function createSignalForm(container) {
  const target = typeof container === "string" ? document.querySelector(container) : container;
  if (!target) return { getValues: () => ({}), setValues: () => {}, onChange: () => {} };

  function getValues() {
    return {
      angleDeg: toFloat(target.querySelector('[data-field="angleDeg"]')?.value, 0),
      anchorIndex: toInt(target.querySelector('[data-field="anchorIndex"]')?.value, 0),
      anchorPrice: toFloat(target.querySelector('[data-field="anchorPrice"]')?.value, 0),
      direction: target.querySelector('[data-field="direction"]')?.value ?? "AUTO",
      atrPeriod: toInt(target.querySelector('[data-field="atrPeriod"]')?.value, 14, 1),
      atrMultiplier: toFloat(target.querySelector('[data-field="atrMultiplier"]')?.value, 1, 0.01),
      entryMode: target.querySelector('[data-field="entryMode"]')?.value ?? "BREAKOUT_RETEST",
      takeProfitRR: toFloat(target.querySelector('[data-field="takeProfitRR"]')?.value, 2, 0.1),
      stopLossATR: toFloat(target.querySelector('[data-field="stopLossATR"]')?.value, 1, 0.1)
    };
  }

  function setValues(config = {}) {
    const pairs = [
      { field: "angleDeg", value: String(config.angleDeg ?? 0) },
      { field: "anchorIndex", value: String(config.anchorIndex ?? 0) },
      { field: "anchorPrice", value: String(config.anchorPrice ?? 0) },
      { field: "direction", value: config.direction ?? "AUTO" },
      { field: "atrPeriod", value: String(config.atrPeriod ?? 14) },
      { field: "atrMultiplier", value: String(config.atrMultiplier ?? 1) },
      { field: "entryMode", value: config.entryMode ?? "BREAKOUT_RETEST" },
      { field: "takeProfitRR", value: String(config.takeProfitRR ?? 2) },
      { field: "stopLossATR", value: String(config.stopLossATR ?? 1) }
    ];
    pairs.forEach(({ field, value }) => {
      const node = target.querySelector(`[data-field="${field}"]`);
      if (node) node.value = value;
    });
  }

  function onChange(listener) {
    if (typeof listener !== "function") return;
    target.querySelectorAll("input, select").forEach((element) => {
      element.addEventListener("input", () => listener(getValues()), { passive: true });
    });
  }

  return { getValues, setValues, onChange };
}

function toFloat(raw, fallback = 0, min = -Infinity) {
  const value = Number.parseFloat(String(raw ?? "").trim());
  return Number.isFinite(value) && value >= min ? value : fallback;
}

function toInt(raw, fallback = 0, min = -Infinity) {
  const value = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(value) && value >= min ? value : fallback;
}
