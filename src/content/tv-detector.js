// src/content/tv-detector.js

function normalizeScore(score) {
  return Math.max(0, Math.min(1, score));
}

export function detectTradingViewPresence(doc = document) {
  let score = 0;
  const reasons = [];

  const hasWindowTv = typeof window.TradingView !== "undefined";
  if (hasWindowTv) {
    score += 0.5;
    reasons.push("window.TradingView present");
  }

  const tvIframes = Array.from(doc.querySelectorAll("iframe[src]"))
    .filter((f) => /tradingview|s3\.tradingview|tv-widget|charting_library/i.test(f.src));
  if (tvIframes.length > 0) {
    score += 0.3;
    reasons.push(`TradingView-like iframe(s): ${tvIframes.length}`);
  }

  const widgetScript = Array.from(doc.querySelectorAll("script[src]"))
    .some((s) => /tradingview|tv\.js|charting_library/i.test(s.src));
  if (widgetScript) {
    score += 0.2;
    reasons.push("TradingView-like script src");
  }

  const tvClassOrId = !!doc.querySelector(
    "[class*='tradingview'],[id*='tradingview'],[class*='tv-'],[id*='tv-']"
  );
  if (tvClassOrId) {
    score += 0.15;
    reasons.push("TradingView-like DOM class/id");
  }

  const confidence = normalizeScore(score);
  const detected = confidence >= 0.35;

  return {
    detected,
    confidence,
    reasons,
    frameCount: tvIframes.length
  };
}
