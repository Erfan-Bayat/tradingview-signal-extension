// src/content/chart-context-extractor.js

const TF_CANONICAL = {
  "1": "1M", "3": "3M", "5": "5M", "15": "15M", "30": "30M", "45": "45M",
  "60": "1H", "120": "2H", "180": "3H", "240": "4H",
  "1H": "1H", "2H": "2H", "3H": "3H", "4H": "4H",
  "1D": "D", "D": "D", "1W": "W", "W": "W", "1MO": "M", "1MTH": "M", "M": "M",
  "1S": "1S", "5S": "5S", "10S": "10S", "15S": "15S", "30S": "30S"
};

const SYMBOL_REGEXES = [
  /\b([A-Z0-9]{2,20}:[A-Z0-9._-]{2,30})\b/g,  // BINANCE:BTCUSDT
  /\b([A-Z]{3,12}\/[A-Z]{3,12})\b/g,          // EUR/USD
  /\b([A-Z]{2,12}[A-Z0-9]{0,8})\b/g           // BTCUSDT, XAUUSD
];

function normalizeTf(raw) {
  if (!raw) return null;
  const up = String(raw).trim().toUpperCase();
  return TF_CANONICAL[up] ?? (TF_CANONICAL[up.replace(/\s+/g, "")] ?? null);
}

function pickSymbol(text) {
  if (!text) return null;
  for (const re of SYMBOL_REGEXES) {
    const match = re.exec(text);
    re.lastIndex = 0;
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

function readMeta(doc) {
  const ogTitle = doc.querySelector("meta[property='og:title']")?.content ?? "";
  const title = doc.title ?? "";
  return `${ogTitle} ${title}`;
}

function readDataAttrs(doc) {
  const nodes = Array.from(
    doc.querySelectorAll("[data-symbol],[data-ticker],[data-fullsymbol],[data-name],[data-interval],[data-timeframe]")
  );
  const parts = [];
  for (const n of nodes) {
    ["data-symbol", "data-ticker", "data-fullsymbol", "data-name", "data-interval", "data-timeframe"].forEach((k) => {
      const v = n.getAttribute(k);
      if (v) parts.push(v);
    });
    if (n.textContent) parts.push(n.textContent);
  }
  return parts.join(" ");
}

function readJsonLd(doc) {
  const scripts = Array.from(doc.querySelectorAll("script[type='application/ld+json']"));
  return scripts.map((s) => s.textContent || "").join(" ");
}

function pickTimeframe(blob) {
  if (!blob) return null;
  const tfCandidates = [
    /\b(1S|5S|10S|15S|30S)\b/i,
    /\b(1|3|5|15|30|45|60|120|180|240)\b/,
    /\b(1H|2H|3H|4H|1D|D|1W|W|1MO|1MTH|M)\b/i
  ];
  for (const re of tfCandidates) {
    const m = blob.match(re);
    if (m?.[1]) {
      const n = normalizeTf(m[1]);
      if (n) return n;
    }
  }
  return null;
}

export function extractChartContext(doc = document) {
  const metaBlob = readMeta(doc);
  const attrBlob = readDataAttrs(doc);
  const jsonBlob = readJsonLd(doc);
  const merged = `${attrBlob} ${metaBlob} ${jsonBlob}`;

  const symbol = pickSymbol(merged);
  const timeframe = pickTimeframe(merged);

  return {
    symbol: symbol ?? null,
    timeframe: timeframe ?? null,
    symbolSource: symbol ? "multi-heuristic" : null,
    timeframeSource: timeframe ? "multi-heuristic" : null
  };
}
