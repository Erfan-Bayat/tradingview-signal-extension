// src/adapters/hivaex-adapter.js

import { BaseAdapter } from "./base-adapter.js";
import { detectPlatformName } from "../content/platform-detector.js";
import { parsePersianNumber } from "../shared/number-utils.js";

export class HivaexAdapter extends BaseAdapter {
  static get id() {
    return "hivaex";
  }

  static canHandle({ locationLike }) {
    const host = String(locationLike?.hostname ?? "").toLowerCase();
    return host === "hivaex.ir" || host === "www.hivaex.ir" || host.endsWith(".hivaex.ir");
  }

  getPlatformInfo() {
    return detectPlatformName(window.location, document);
  }

  getContext() {
    const href = String(window.location.href || "");
    const host = String(window.location?.hostname || "").toLowerCase();
    if (host === "hivaex.ir" || host === "www.hivaex.ir") {
      return {
        symbol: "OUNCE/GOLD",
        timeframe: "1M",
        symbolSource: "platform",
        timeframeSource: "platform"
      };
    }

    const path = href.split("?")[0] || "";
    const segments = path.split("/").filter(Boolean);
    const symbol = segments[1] || segments[0] || null;

    return {
      symbol: (symbol || null).toUpperCase(),
      timeframe: null,
      symbolSource: "path",
      timeframeSource: "path"
    };
  }

  getLivePrice() {
    const btn = document.querySelector("button.gold-gradient");
    if (!btn) return null;
    const text = btn.textContent || "";
    const n = parsePersianNumber(text);
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  }

  getLastCandle() {
    const liveNodes = Array.from(document.querySelectorAll("[data-test], [class]"));
    return null;
  }
}
