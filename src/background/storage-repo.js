// src/background/storage-repo.js
import { STORAGE_KEYS, DEFAULT_SESSION_STATE, DEFAULT_SIGNAL_CONFIG } from "../shared/constants.js";

function getLastError(context) {
  if (chrome.runtime.lastError) {
    return new Error(`[storage-repo] ${context}: ${chrome.runtime.lastError.message}`);
  }
  return null;
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      const err = getLastError(`storage.local.get(${JSON.stringify(keys)})`);
      if (err) return reject(err);
      resolve(result ?? {});
    });
  });
}

function storageSet(payload) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(payload, () => {
      const err = getLastError(`storage.local.set(${Object.keys(payload).join(",")})`);
      if (err) return reject(err);
      resolve(true);
    });
  });
}

export async function getSignalConfig() {
  const data = await storageGet([STORAGE_KEYS.SIGNAL_CONFIG]);
  return data[STORAGE_KEYS.SIGNAL_CONFIG] ?? { ...DEFAULT_SIGNAL_CONFIG };
}

export async function setSignalConfig(config) {
  await storageSet({ [STORAGE_KEYS.SIGNAL_CONFIG]: config });
}

export async function getSessionState() {
  const data = await storageGet([STORAGE_KEYS.SESSION]);
  return data[STORAGE_KEYS.SESSION] ?? { ...DEFAULT_SESSION_STATE };
}

export async function setSessionState(session) {
  await storageSet({ [STORAGE_KEYS.SESSION]: session });
}

export async function getTradeLogs() {
  const data = await storageGet([STORAGE_KEYS.TRADE_LOGS]);
  return data[STORAGE_KEYS.TRADE_LOGS] ?? [];
}

export async function appendTradeLog(entry) {
  const current = await getTradeLogs();
  current.push(entry);
  await storageSet({ [STORAGE_KEYS.TRADE_LOGS]: current });
  return current;
}

export async function setLastContext(context) {
  await storageSet({ [STORAGE_KEYS.LAST_CONTEXT]: context });
}
