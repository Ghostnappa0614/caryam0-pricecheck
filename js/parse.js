// Turns typed or pasted text into a list of prices.
//   "285 310 $1,250.00, 140.5"  ->  [285, 310, 1250, 140.5]
// A comma counts as a thousands separator only when it is followed by exactly
// three digits (1,250 or 12,345,678). Anything else is treated as a list separator.
const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+/;
const NUMBERS = new RegExp(NUMBER.source, 'g');

const toCents = (s) => Math.round(Number(s.replace(/,/g, '')) * 100) / 100;

export function parsePrices(text) {
  if (!text) return [];
  return [...String(text).matchAll(NUMBERS)]
    .map((m) => toCents(m[0]))
    .filter((n) => Number.isFinite(n) && n > 0);
}

// For single money fields (asking price, shipping). Returns null when blank or
// invalid; 0 is allowed (a free item, or free-to-ship).
export function parseMoney(text) {
  const match = String(text ?? '').match(NUMBER);
  if (!match) return null;
  const n = toCents(match[0]);
  return Number.isFinite(n) ? n : null;
}
