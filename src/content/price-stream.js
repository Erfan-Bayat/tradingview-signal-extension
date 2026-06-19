// src/content/price-stream.js

function parseNumber(raw) {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function findPriceFromDom(doc = document) {
  const selectors = [
    "[data-last-price]",
    "[data-price]",
    "[class*='last-price']",
    "[class*='priceValue']",
    "[class*='tv-symbol-price-quote']",
    "[class*='price']"
  ];

  for (const sel of selectors) {
    const nodes = Array.from(doc.querySelectorAll(sel));
    for (const node of nodes) {
      const attrs = [
        node.getAttribute("data-last-price"),
        node.getAttribute("data-price"),
        node.textContent
      ];
      for (const val of attrs) {
        const n = parseNumber(val);
        if (n != null) return n;
      }
    }
  }

  return null;
}

export function createPriceStream({ adapter, intervalMs = 1000 } = {}) {
  let timer = null;
  let lastPrice = null;
  let started = false;

  function readPrice() {
    const adapterPrice = adapter?.getLivePrice?.();
    const domPrice = findPriceFromDom(document);
    const price = adapterPrice ?? domPrice ?? null;
    return Number.isFinite(price) ? price : null;
  }

  return {
    start(onTick) {
      if (started) return;
      started = true;
      timer = window.setInterval(() => {
        const price = readPrice();
        if (price == null) return;
        if (price !== lastPrice) {
          lastPrice = price;
          onTick?.({ price, ts: Date.now() });
        }
      }, intervalMs);
    },
    stop() {
      started = false;
      if (timer) clearInterval(timer);
      timer = null;
    }
  };
}
