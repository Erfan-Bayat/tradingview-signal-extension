// src/adapters/embedded-tradingview-adapter.js

import { BaseAdapter } from "./base-adapter.js";
import { detectPlatformName } from "../content/platform-detector.js";
import { extractChartContext } from "../content/chart-context-extractor.js";

export class EmbeddedTradingViewAdapter extends BaseAdapter {
  static get id() {
    return "embedded-tradingview";
  }

  static canHandle({ documentLike, locationLike }) {
    const host = locationLike?.hostname?.toLowerCase() ?? "";
    if (host.includes("tradingview.com")) return false;

    const hasTvIframe = Array.from(documentLike.querySelectorAll("iframe[src]"))
      .some((f) => /tradingview|charting_library|tv-widget/i.test(f.src));

    return hasTvIframe;
  }

  getPlatformInfo() {
    return detectPlatformName(window.location, document);
  }

  getContext() {
    return extractChartContext(document);
  }
}
