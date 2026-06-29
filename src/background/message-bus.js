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

async function ensureContentScript(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.url) return false;
    const host = new URL(tab.url).hostname;
    if (host !== "hivaex.ir" && !host.endsWith(".hivaex.ir")) return false;

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["dist/content/content-entry.js"]
    });
    return Boolean(result);
  } catch (err) {
    logger.debug("message-bus", "ensureContentScript failed", err?.message);
    return false;
  }
}

export function sendToTabWithRetry(tabId, message, attempts = 2) {
  return new Promise((resolve) => {
    let injected = false;
    function attempt(retries) {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          logger.warn("message-bus", `tabs.sendMessage failed (retries=${retries}): ${chrome.runtime.lastError.message}`);
          if (retries <= 1) return resolve(null);
          if (!injected) {
            injected = true;
            ensureContentScript(tabId).then(() => setTimeout(() => attempt(retries - 1), 500));
          } else {
            setTimeout(() => attempt(retries - 1), 500);
          }
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
  return sendToTabWithRetry(tabId, { type: MessageType.REQUEST_CONTEXT });
}

export function startStreamOnTab(tabId) {
  return sendToTabWithRetry(tabId, { type: MessageType.START_STREAM });
}

export function stopStreamOnTab(tabId) {
  return sendToTabWithRetry(tabId, { type: MessageType.STOP_STREAM });
}

export function probeChartOnActiveTab() {
  return queryActiveTab().then((tab) => {
    if (!tab?.id) return { ok: false, error: "NO_ACTIVE_TAB" };
    return sendToTabWithRetry(tab.id, { type: MessageType.PROBE_CHART }).then((res) => ({ ok: true, tabId: tab.id, response: res }));
  });
}
