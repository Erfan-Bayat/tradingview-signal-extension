// src/background/session-manager.js
import { getSessionState, setSessionState } from "./storage-repo.js";
import { queryActiveTab, requestContextOnTab, startStreamOnTab, stopStreamOnTab } from "./message-bus.js";

const RECONNECT_DELAY_MS = 1200;
let reconnectTimer = null;

export async function markMonitoringStopped() {
  const s = await getSessionState();
  await setSessionState({ ...s, monitoring: false, updatedAt: Date.now() });
}

export async function recoverIfNeeded() {
  const s = await getSessionState();
  if (!s?.monitoring) return { ok: true, recovered: false };

  const tab = await queryActiveTab();
  if (!tab?.id) {
    await markMonitoringStopped();
    return { ok: false, recovered: false, error: "NO_ACTIVE_TAB" };
  }

  await requestContextOnTab(tab.id);
  await startStreamOnTab(tab.id);
  await setSessionState({ ...s, tabId: tab.id, updatedAt: Date.now() });
  return { ok: true, recovered: true, tabId: tab.id };
}

export function scheduleReconnect(task) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await task();
  }, RECONNECT_DELAY_MS);
}

export async function stopForTab(tabId) {
  const s = await getSessionState();
  if (s?.tabId === tabId && s?.monitoring) {
    await stopStreamOnTab(tabId);
    await setSessionState({ ...s, monitoring: false, updatedAt: Date.now() });
  }
}
