// src/adapters/base-adapter.js

export class BaseAdapter {
  constructor() {
    this.initialized = false;
  }

  static get id() {
    return "base";
  }

  static canHandle() {
    return false;
  }

  init() {
    this.initialized = true;
  }

  destroy() {
    this.initialized = false;
  }

  getPlatformInfo() {
    return { platformName: null, source: "adapter" };
  }

  getContext() {
    return { symbol: null, timeframe: null, symbolSource: null, timeframeSource: null };
  }

  getLivePrice() {
    return null;
  }

  getLastCandle() {
    return null;
  }
}
