// src/adapters/adapter-registry.js

import { TradingViewDirectAdapter } from "./tradingview-direct-adapter.js";
import { EmbeddedTradingViewAdapter } from "./embedded-tradingview-adapter.js";
import { GenericWidgetAdapter } from "./generic-widget-adapter.js";
import { FallbackDomAdapter } from "./fallback-dom-adapter.js";

const ADAPTERS = [
  TradingViewDirectAdapter,
  EmbeddedTradingViewAdapter,
  GenericWidgetAdapter,
  FallbackDomAdapter
];

export function selectAdapter({
  documentLike = document,
  locationLike = window.location
} = {}) {
  for (const AdapterClass of ADAPTERS) {
    if (AdapterClass.canHandle({ documentLike, locationLike })) {
      const adapter = new AdapterClass();
      adapter.init();
      return adapter;
    }
  }

  const fallback = new FallbackDomAdapter();
  fallback.init();
  return fallback;
}
