import type { ExpiryPrecision } from "./types";
export type ExpiryState =
  "Valid" | "Expiring soon" | "Expired" | "Expiry unknown";
export function localISO(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseExpiry(input: string): {
  expiry: string | null;
  precision: ExpiryPrecision;
} {
  const text = input.trim();
  if (!text) return { expiry: null, precision: "unknown" };
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(text);
  if (!m) throw new Error("Use YYYY-MM or YYYY-MM-DD for the expiry date.");
  const year = +m[1],
    month = +m[2];
  if (year < 1900 || year > 2199 || month < 1 || month > 12)
    throw new Error("Enter a valid expiry date.");
  const last = new Date(year, month, 0).getDate();
  const day = m[3] ? +m[3] : last;
  if (day < 1 || day > last)
    throw new Error("The expiry day does not exist in this month.");
  return {
    expiry: `${m[1]}-${m[2]}-${String(day).padStart(2, "0")}`,
    precision: m[3] ? "day" : "month",
  };
}
export function gs1Expiry(value: string, now = new Date()): string {
  if (!/^\d{6}$/.test(value)) throw new Error("Invalid GS1 expiry date.");
  // Interpret YY in the GS1 rolling window: 49 years before to 50 years after today.
  const yy = +value.slice(0, 2),
    current = now.getFullYear();
  let year = Math.floor(current / 100) * 100 + yy;
  if (year < current - 49) year += 100;
  if (year > current + 50) year -= 100;
  const base = `${year}-${value.slice(2, 4)}`;
  return parseExpiry(
    value.slice(4) === "00" ? base : `${base}-${value.slice(4)}`,
  ).expiry!;
}
export function expiryState(
  expiry: string | null,
  now = new Date(),
  soonDays = 30,
): ExpiryState {
  if (!expiry) return "Expiry unknown";
  const today = localISO(now);
  if (expiry < today) return "Expired";
  const [y, m, d] = today.split("-").map(Number),
    [ey, em, ed] = expiry.split("-").map(Number);
  const days = Math.round(
    (Date.UTC(ey, em - 1, ed) - Date.UTC(y, m - 1, d)) / 86400000,
  );
  return days <= soonDays ? "Expiring soon" : "Valid";
}
export function formatExpiry(
  expiry: string | null,
  precision: ExpiryPrecision = "day",
): string {
  if (!expiry || precision === "unknown") return "Not recorded";
  const [y, m, d] = expiry.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(
    "en-GB",
    precision === "month"
      ? { month: "short", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" },
  );
}
