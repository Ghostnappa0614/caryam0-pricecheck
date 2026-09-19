// Runs the BUILT bookmarklet (exactly what Dad pastes into his bookmark)
// against saved eBay pages in jsdom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildBookmarklet, moduleSource, OUTPUT_PATH } from '../bookmarklet/build.mjs';
import { priceStats } from '../public/js/calc.js';
import { parsePrices } from '../public/js/parse.js';

const url = await buildBookmarklet();
const code = url.slice('javascript:'.length);

async function runOn(fixture, pageUrl = 'https://www.ebay.com/sch/i.html?_nkw=x&LH_Sold=1&LH_Complete=1&_sop=13') {
  const html = await readFile(new URL(`./fixtures/${fixture}`, import.meta.url), 'utf8');
  // eBay's own CSS doesn't parse cleanly in jsdom; that noise isn't relevant here.
  const dom = new JSDOM(html, { url: pageUrl, runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  dom.window.eval(code);
  const card = dom.window.document.getElementById('caryam0-grab-card');
  return { dom, card, prices: parsePrices(card?.getAttribute('data-prices')) };
}

test('built bookmarklet has no # or % and is up to date in the app', async () => {
  assert.ok(url.startsWith('javascript:'));
  assert.ok(!url.includes('#') && !url.includes('%'));
  const current = await readFile(OUTPUT_PATH, 'utf8');
  assert.equal(current, moduleSource(url), 'Run `npm run build:bookmarklet` and commit the result.');
});

test('real eBay sold page (Pioneer SX-780): 60 prices, placeholders skipped', async () => {
  const { card, prices } = await runOn('ebay-sold-pioneer-sx780.html');
  assert.ok(card, 'card is shown');
  assert.equal(prices.length, 60);
  // First real results, in page order ("Shop on eBay" placeholders skipped).
  assert.deepEqual(prices.slice(0, 5), [20, 24.5, 19.5, 20, 64.99]);
  assert.ok(prices.includes(1499.36), 'thousands separator handled');
  assert.equal(Math.min(...prices), 7.5);
  assert.equal(Math.max(...prices), 1499.36);

  // The card's numbers agree with the app's own math.
  const s = priceStats(prices);
  const text = card.textContent;
  assert.match(text, /Found 60 sold prices/);
  const fmt = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.ok(text.includes('Typical ' + fmt(s.median)), text);
  assert.ok(text.includes('Average ' + fmt(s.average)), text);
  assert.ok(text.includes('Range $7.50 to $1,499.36'), text);
});

test('older s-item markup: range takes low end, stops at "fewer words" divider', async () => {
  const { card, prices } = await runOn('ebay-sold-older-markup.html');
  assert.deepEqual(prices, [285, 1250, 140.5, 310]);
  assert.match(card.textContent, /Typical \$297\.50/);
  assert.match(card.textContent, /Range \$140\.50 to \$1,250\.00/);
});

test('Copy prices writes plain space-separated numbers to the clipboard', async () => {
  const { dom, card } = await runOn('ebay-sold-older-markup.html');
  let copied = null;
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    value: { writeText: (t) => { copied = t; return Promise.resolve(); } },
  });
  const copy = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Copy prices');
  copy.click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(copied, '285 1250 140.5 310');
  assert.match(copy.textContent, /Copied/);
});

test('falls back to prompt() when clipboard is unavailable', async () => {
  const { dom, card } = await runOn('ebay-sold-older-markup.html');
  let prompted = null;
  dom.window.document.execCommand = () => false;
  dom.window.prompt = (_msg, value) => { prompted = value; };
  [...card.querySelectorAll('button')].find((b) => b.textContent === 'Copy prices').click();
  assert.equal(prompted, '285 1250 140.5 310');
});

test('Close removes the card; running twice shows only one card', async () => {
  const { dom, card } = await runOn('ebay-sold-older-markup.html');
  dom.window.eval(code);
  assert.equal(dom.window.document.querySelectorAll('[id=caryam0-grab-card]').length, 1);
  const again = dom.window.document.getElementById('caryam0-grab-card');
  [...again.querySelectorAll('button')].find((b) => b.textContent === 'Close').click();
  assert.equal(dom.window.document.getElementById('caryam0-grab-card'), null);
  assert.ok(card);
});

test('page with no results: friendly message instead of numbers', () => {
  const dom = new JSDOM('<p>hello</p>', { url: 'https://www.google.com/', runScripts: 'outside-only' });
  dom.window.eval(code);
  const card = dom.window.document.getElementById('caryam0-grab-card');
  assert.match(card.textContent, /No sold prices found/);
  assert.match(card.textContent, /does not look like an eBay sold-listings page/);
  assert.equal(card.querySelectorAll('button').length, 1); // just Close
});
