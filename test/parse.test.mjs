import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrices, parseMoney } from '../public/js/parse.js';
import { soldListingsUrl } from '../public/js/ebay-url.js';

test('spec example: thousands separators do not split numbers', () => {
  assert.deepEqual(parsePrices('285 310 $1,250.00, 140.5'), [285, 310, 1250, 140.5]);
});

test('newlines, tabs, commas and dollar signs all separate prices', () => {
  assert.deepEqual(parsePrices('$20.00\n$24.50\t19.5,20'), [20, 24.5, 19.5, 20]);
});

test('big numbers with several separators', () => {
  assert.deepEqual(parsePrices('$12,345,678.90'), [12345678.9]);
});

test('a comma not followed by 3 digits is a list separator', () => {
  assert.deepEqual(parsePrices('12,5 7,50'), [12, 5, 7, 50]);
});

test('bookmarklet output pastes cleanly', () => {
  assert.deepEqual(parsePrices('20 24.5 1499.36 7.5'), [20, 24.5, 1499.36, 7.5]);
});

test('ignores words, zeros and blanks', () => {
  assert.deepEqual(parsePrices('about $40 or so, maybe 0'), [40]);
  assert.deepEqual(parsePrices(''), []);
  assert.deepEqual(parsePrices(null), []);
  assert.deepEqual(parsePrices('.99'), [0.99]);
});

test('parseMoney for single fields', () => {
  assert.equal(parseMoney('$1,250'), 1250);
  assert.equal(parseMoney(' 12.99 '), 12.99);
  assert.equal(parseMoney('0'), 0);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('abc'), null);
});

test('eBay sold-listings URL with each condition', () => {
  const base = 'https://www.ebay.com/sch/i.html?_nkw=Pioneer%20SX-780&LH_Sold=1&LH_Complete=1&_sop=13';
  assert.equal(soldListingsUrl(' Pioneer SX-780 '), base);
  assert.equal(soldListingsUrl('Pioneer SX-780', 'any'), base);
  assert.equal(soldListingsUrl('Pioneer SX-780', 'used'), base + '&LH_ItemCondition=3000');
  assert.equal(soldListingsUrl('Pioneer SX-780', 'new'), base + '&LH_ItemCondition=1000');
  assert.equal(soldListingsUrl('Pioneer SX-780', 'parts'), base + '&LH_ItemCondition=7000');
  assert.match(soldListingsUrl('AT&T #5'), /_nkw=AT%26T%20%235&/);
});
