// src/content/platform-detector.js

function toTitleCase(hostname) {
  const root = hostname.replace(/^www\./i, "").split(".")[0] || "Unknown";
  return root.charAt(0).toUpperCase() + root.slice(1);
}

export function detectPlatformName(locationLike = window.location, doc = document) {
  const hostname = locationLike?.hostname ?? "unknown";
  const hostLc = hostname.toLowerCase();

  if (hostLc.includes("tradingview.com")) {
    return { platformName: "TradingView", source: "hostname" };
  }

  const brandMeta =
    doc.querySelector("meta[property='og:site_name']")?.content ||
    doc.querySelector("meta[name='application-name']")?.content ||
    doc.querySelector("meta[name='apple-mobile-web-app-title']")?.content;

  if (brandMeta && brandMeta.trim()) {
    return { platformName: brandMeta.trim(), source: "meta" };
  }

  const title = (doc.title || "").trim();
  if (title) {
    const candidate = title.split("|")[0].split("-")[0].trim();
    if (candidate.length >= 2) {
      return { platformName: candidate, source: "title" };
    }
  }

  return { platformName: toTitleCase(hostname), source: "hostname-fallback" };
}
