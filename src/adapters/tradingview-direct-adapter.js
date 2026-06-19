// src/adapters/tradingview-direct-adapter.js

import { BaseAdapter } from "./base-adapter.js";
import { detectPlatformName } from "../content/platform-detector.js";
import { extractChartContext } from "../content/chart-context-extractor.js";

export class TradingViewDirectAdapter extends BaseAdapter {
  static get id() {
    return "tradingview-direct";
  }

  static canHandle({ locationLike }) {
    const host = locationLike?.hostname?.toLowerCase() ?? "";
    return host.includes("tradingview.com");
  }

  getPlatformInfo() {
    return detectPlatformName(window.location, document);
  }

  getContext() {
    return extractChartContext(document);
  }
}
