// src/adapters/generic-widget-adapter.js

import { BaseAdapter } from "./base-adapter.js";
import { detectPlatformName } from "../content/platform-detector.js";
import { extractChartContext } from "../content/chart-context-extractor.js";

export class GenericWidgetAdapter extends BaseAdapter {
  static get id() {
    return "generic-widget";
  }

  static canHandle({ documentLike }) {
    const hasWidgetScript = Array.from(documentLike.querySelectorAll("script[src]"))
      .some((s) => /tradingview|tv\.js|charting_library/i.test(s.src));
    const hasWidgetContainer = !!documentLike.querySelector(
      "[class*='tradingview-widget'],[id*='tradingview-widget'],[class*='tv-widget'],[id*='tv-widget']"
    );
    return hasWidgetScript || hasWidgetContainer;
  }

  getPlatformInfo() {
    return detectPlatformName(window.location, document);
  }

  getContext() {
    return extractChartContext(document);
  }
}
