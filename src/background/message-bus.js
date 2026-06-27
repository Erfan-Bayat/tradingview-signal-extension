// src/background/message-bus.js
import { MessageType } from "../shared/enums.js";
import { logger } from "../shared/logger.js";

export function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        logger.warn("message-bus", `tabs.sendMessage failed: ${chrome.runtime.lastError.message}`);
        resolve(null);
        return;
      }
      resolve(response ?? null);
    });
  });
}

export function sendToTabWithRetry(tabId, message, attempts = 2) {
  return new Promise((resolve) => {
    function attempt(retries) {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          logger.warn("message-bus", `tabs.sendMessage failed (retries=${retries}): ${chrome.runtime.lastError.message}`);
          if (retries <= 1) return resolve(null);
          setTimeout(() => attempt(retries - 1), 500);
          return;
        }
        resolve(response ?? null);
      });
    }
    attempt(attempts);
  });
}

export function notifyPopup(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        logger.debug("message-bus", `notifyPopup suppressed: ${chrome.runtime.lastError.message}`);
        return resolve(null);
      }
      resolve(response ?? null);
    });
  });
}

export function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        logger.warn("message-bus", `queryActiveTab failed: ${chrome.runtime.lastError.message}`);
        return resolve(null);
      }
      resolve(tabs?.[0] ?? null);
    });
  });
}

export function requestContextOnTab(tabId) {
  return sendToTab(tabId, { type: MessageType.REQUEST_CONTEXT });
}

export function startStreamOnTab(tabId) {
  return sendToTab(tabId, { type: MessageType.START_STREAM });
}

export function stopStreamOnTab(tabId) {
  return sendToTab(tabId, { type: MessageType.STOP_STREAM });
}

export function probeChartOnActiveTab() {
  return queryActiveTab().then((tab) => {
    if (!tab?.id) return { ok: false, error: "NO_ACTIVE_TAB" };
    return sendToTabWithRetry(tab.id, { type: MessageType.PROBE_CHART }).then((res) => ({ ok: true, tabId: tab.id, response: res }));
  });
}
