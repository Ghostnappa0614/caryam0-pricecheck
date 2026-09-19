import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median, priceStats, perOrderFee, computeBuy } from '../public/js/calc.js';

const close = (actual, expected, msg) =>
  assert.ok(Math.abs(actual - expected) < 0.005, `${msg ?? ''} expected ${expected}, got ${actual}`);

test('median of odd and even lists, unsorted input', () => {
  assert.equal(median([310, 140, 285]), 285);
  assert.equal(median([400, 100, 300, 200]), 250);
  assert.equal(median([]), null);
});

test('priceStats: count, typical, average, range', () => {
  const s = priceStats([100, 200, 300, 1400]);
  assert.deepEqual(s, { count: 4, median: 250, average: 500, low: 100, high: 1400 });
  assert.equal(priceStats([]), null);
});

test('per-order fee is $0.40 over $10, otherwise $0.30', () => {
  assert.equal(perOrderFee(10.01), 0.4);
  assert.equal(perOrderFee(10), 0.3);
  assert.equal(perOrderFee(4), 0.3);
});

const base = { prices: [285], feeRate: 0.127, targetPercent: 30, ship: 15 };

test('spec example: $285 sale, buyer pays $15 shipping → pay up to about $161', () => {
  const r = computeBuy({ ...base, freeShipping: false });
  close(r.orderTotal, 300);
  close(r.fees, 300 * 0.127 + 0.4, 'fees');
  close(r.profitGoal, 85.5);
  assert.equal(r.shipOutOfPocket, 0);
  close(r.maxBuy, 161.0, 'maxBuy');
});

test('spec example: $285 sale, free shipping → pay up to about $148', () => {
  const r = computeBuy({ ...base, freeShipping: true });
  close(r.orderTotal, 285);
  close(r.fees, 285 * 0.127 + 0.4, 'fees');
  assert.equal(r.shipOutOfPocket, 15);
  close(r.maxBuy, 147.905, 'maxBuy');
  assert.equal(Math.round(r.maxBuy), 148);
});

test('uses the median, not the average, as the sale price', () => {
  const r = computeBuy({ ...base, prices: [250, 285, 300, 5000, 100] });
  assert.equal(r.sale, 285);
  close(r.maxBuy, 161.0);
});

test('small sale uses the $0.30 per-order fee', () => {
  const r = computeBuy({ prices: [8], feeRate: 0.127, targetPercent: 30, ship: 0, freeShipping: false });
  assert.equal(r.orderFee, 0.3);
  close(r.fees, 8 * 0.127 + 0.3);
});

test('buyer-pays order total over $10 uses $0.40 even if the item alone is under $10', () => {
  const r = computeBuy({ prices: [8], feeRate: 0.127, targetPercent: 30, ship: 5, freeShipping: false });
  assert.equal(r.orderFee, 0.4);
});

test('verdict: ask at or under maxBuy → buy, with profit and return %', () => {
  const r = computeBuy({ ...base, freeShipping: false, ask: 50 });
  assert.equal(r.verdict, 'buy');
  close(r.profit, 285 - 38.5 - 50);
  close(r.returnPercent, ((285 - 38.5 - 50) / 50) * 100);
});

test('verdict: ask exactly equal to maxBuy counts as buy', () => {
  const r = computeBuy({ ...base, freeShipping: false, ask: 161 });
  assert.equal(r.verdict, 'buy');
});

test('verdict: profitable but over maxBuy → thin', () => {
  const r = computeBuy({ ...base, freeShipping: false, ask: 200 });
  assert.equal(r.verdict, 'thin');
  close(r.profit, 46.5);
});

test('verdict: no profit → pass (break-even counts as pass)', () => {
  assert.equal(computeBuy({ ...base, freeShipping: false, ask: 300 }).verdict, 'pass');
  assert.equal(computeBuy({ ...base, freeShipping: false, ask: 246.5 }).verdict, 'pass');
});

test('free shipping is taken out of profit', () => {
  const r = computeBuy({ ...base, freeShipping: true, ask: 100 });
  close(r.profit, 285 - (285 * 0.127 + 0.4) - 15 - 100);
});

test('no asking price → no verdict; free item → no return %', () => {
  assert.equal(computeBuy({ ...base }).verdict, null);
  const free = computeBuy({ ...base, ask: 0 });
  assert.equal(free.verdict, 'buy');
  assert.equal(free.returnPercent, null);
});

test('no prices → null', () => {
  assert.equal(computeBuy({ ...base, prices: [] }), null);
});
