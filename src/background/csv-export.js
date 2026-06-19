// src/background/csv-export.js

function escapeCsv(value) {
  if (value == null) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function logsToCsv(logs = []) {
  const headers = ["ts", "event", "state", "from", "to", "price", "symbol", "timeframe", "details"];
  const lines = [headers.join(",")];

  for (const row of logs) {
    const line = [
      row.ts ?? "",
      row.event ?? "",
      row.state ?? "",
      row.transition?.from ?? row.from ?? "",
      row.transition?.to ?? row.to ?? "",
      row.price ?? "",
      row.symbol ?? "",
      row.timeframe ?? "",
      row.payload ?? row.details ?? ""
    ].map(escapeCsv);
    lines.push(line.join(","));
  }

  return lines.join("\n");
}
