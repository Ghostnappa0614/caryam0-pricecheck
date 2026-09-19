// Pure math for the buy calculator. No DOM, no storage — easy to test.

export const round2 = (n) => Math.round(n * 100) / 100;

export function median(values) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// Summary of a list of sold prices. Returns null for an empty list.
export function priceStats(prices) {
  if (!prices.length) return null;
  const sum = prices.reduce((s, p) => s + p, 0);
  return {
    count: prices.length,
    median: median(prices),
    average: sum / prices.length,
    low: Math.min(...prices),
    high: Math.max(...prices),
  };
}

// eBay's per-order fee: $0.40 when the order total is over $10, otherwise $0.30.
export function perOrderFee(orderTotal) {
  return orderTotal > 10 ? 0.4 : 0.3;
}

/**
 * The buy decision.
 *   prices        sold prices (the median becomes the expected sale price)
 *   feeRate       e.g. 0.127
 *   targetPercent profit goal as a percent of the sale price, e.g. 30
 *   ship          shipping cost in dollars
 *   freeShipping  true = seller pays shipping, false = buyer pays
 *   ask           asking/sticker price, or null if not entered
 */
export function computeBuy({ prices, feeRate, targetPercent, ship = 0, freeShipping = false, ask = null }) {
  const stats = priceStats(prices);
  if (!stats) return null;

  const sale = stats.median;
  const orderTotal = freeShipping ? sale : sale + ship;
  const orderFee = perOrderFee(orderTotal);
  const percentFee = orderTotal * feeRate;
  const fees = percentFee + orderFee;
  const shipOutOfPocket = freeShipping ? ship : 0;
  const profitGoal = sale * (targetPercent / 100);
  const maxBuy = sale - fees - shipOutOfPocket - profitGoal;

  const result = {
    stats, sale, orderTotal, feeRate, percentFee, orderFee, fees,
    freeShipping, ship, shipOutOfPocket, targetPercent, profitGoal, maxBuy,
    ask: null, profit: null, returnPercent: null, verdict: null,
  };

  if (ask != null && Number.isFinite(ask) && ask >= 0) {
    const profit = sale - fees - shipOutOfPocket - ask;
    result.ask = ask;
    result.profit = profit;
    result.returnPercent = ask > 0 ? (profit / ask) * 100 : null;
    // Compare at cent precision so float noise can't flip a verdict.
    if (round2(ask) <= round2(maxBuy)) result.verdict = 'buy';
    else if (round2(profit) > 0) result.verdict = 'thin';
    else result.verdict = 'pass';
  }
  return result;
}
