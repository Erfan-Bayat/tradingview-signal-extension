// src/shared/time-utils.js

export function secondsToMs(sec) {
  const n = Number(sec);
  return Number.isFinite(n) ? Math.round(n * 1000) : null;
}

export function msToSeconds(ms) {
  const n = Number(ms);
  return Number.isFinite(n) ? Math.floor(n / 1000) : null;
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

// Floor a unix-seconds timestamp to the start of its N-second bucket.
export function bucketStartSeconds(unixSeconds, bucketSeconds = 60) {
  const n = Number(unixSeconds);
  if (!Number.isFinite(n) || bucketSeconds <= 0) return null;
  return Math.floor(n / bucketSeconds) * bucketSeconds;
}

// Parse a resolution string like "60s", "1m", "300" into seconds.
export function resolutionToSeconds(resolution) {
  if (resolution == null) return 60;
  const str = String(resolution).trim().toLowerCase();
  const m = str.match(/^(\d+)\s*(s|m|h|d)?$/);
  if (!m) return 60;
  const value = Number(m[1]);
  const unit = m[2] || "s";
  const mult = unit === "m" ? 60 : unit === "h" ? 3600 : unit === "d" ? 86400 : 1;
  return value * mult;
}