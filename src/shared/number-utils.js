// src/shared/number-utils.js

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

// Convert Persian/Arabic-Indic digits in a string to ASCII digits.
export function toAsciiDigits(input) {
  if (input == null) return "";
  let s = String(input);
  for (let d = 0; d < 10; d++) {
    s = s
      .replace(new RegExp(PERSIAN_DIGITS[d], "g"), String(d))
      .replace(new RegExp(ARABIC_DIGITS[d], "g"), String(d));
  }
  // Normalize Persian/Arabic thousands and decimal separators.
  s = s.replace(/\u066c/g, "").replace(/\u066b/g, ".");
  return s;
}

// Parse a possibly-Persian numeric string (e.g. "۶۵,۰۴۶") into a Number (65046).
export function parsePersianNumber(input) {
  if (input == null) return null;
  const ascii = toAsciiDigits(input).replace(/[^0-9.\-]/g, "");
  if (ascii === "" || ascii === "-" || ascii === ".") return null;
  const n = Number(ascii);
  return Number.isFinite(n) ? n : null;
}

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}