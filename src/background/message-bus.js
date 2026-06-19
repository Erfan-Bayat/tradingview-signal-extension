// src/background/message-bus.js
import { MessageType } from "../shared/enums.js";
import { logger } from "../shared/logger.js";

function lastError(context) {
  if (chrome.runtime.lastError) {
    logger.warn("message-bus", `${context}: ${chrome.runtime.lastError.message}`);
    return true;
  }
  return false;
}

export function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (lastError("tabs.query(active)")) return resolve(null);
      resolve(tabs?.[0] ?? null);
    });
  });
}

export function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (lastError(`tabs.sendMessage(${message?.type})`)) return resolve(null);
      resolve(response ?? null);
    });
  });
}

export function notifyPopup(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (lastError(`runtime.sendMessage(${type})`)) return resolve(null);
      resolve(response ?? null);
    });
  });
}

export async function probeChartOnActiveTab() {
  const tab = await queryActiveTab();
  if (!tab?.id) return { ok: false, error: "NO_ACTIVE_TAB" };
  const res = await sendToTab(tab.id, { type: MessageType.PROBE_CHART });
  return { ok: true, tabId: tab.id, response: res };
}

export async function requestContextOnTab(tabId) {
  const res = await sendToTab(tabId, { type: MessageType.REQUEST_CONTEXT });
  return res;
}

export async function startStreamOnTab(tabId) {
  const res = await sendToTab(tabId, { type: MessageType.START_STREAM });
  return res;
}

export async function stopStreamOnTab(tabId) {
  const res = await sendToTab(tabId, { type: MessageType.STOP_STREAM });
  return res;
}
