// src/popup/trade-log-view.js

export function createTradeLogView(container) {
  const target = typeof container === "string" ? document.querySelector(container) : container;
  if (!target) return { render: () => {}, clear: () => {} };

  function render(logs = []) {
    target.textContent = logs
      .slice(-50)
      .reverse()
      .map((logItem) => JSON.stringify(logItem))
      .join("\n");
  }

  function clear() {
    target.textContent = "Waiting...";
  }

  return { render, clear };
}
