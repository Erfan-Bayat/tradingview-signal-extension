// src/adapters/fallback-dom-adapter.js

import { BaseAdapter } from "./base-adapter.js";
import { detectPlatformName } from "../content/platform-detector.js";
import { extractChartContext } from "../content/chart-context-extractor.js";

export class FallbackDomAdapter extends BaseAdapter {
  static get id() {
    return "fallback-dom";
  }

  static canHandle() {
    return true;
  }

  getPlatformInfo() {
    return detectPlatformName(window.location, document);
  }

  getContext() {
    return extractChartContext(document);
  }
}
