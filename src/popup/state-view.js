// src/popup/state-view.js

export function mount(mountPoint = document) {
  return {
    setContext: (context = {}) => {
      const target = mountPoint;
      if (!target) return;
      ["platform", "symbol", "timeframe", "engineState", "lastPrice", "brokerStatus"].forEach((field) => {
        const element = target.querySelector(`[data-field="${field}"]`);
        if (!element) return;
        const value = context[field];
        element.textContent = value ?? "-";
      });
    },
    appendTransition: (transition = {}) => {
      const list = mountPoint.querySelector(".log");
      if (!list) return;
      const row = document.createElement("div");
      row.textContent = JSON.stringify(transition);
      list.prepend(row);
    }
  };
}
