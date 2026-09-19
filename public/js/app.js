// Wires the screen together. Math lives in calc.js, parsing in parse.js,
// saving in storage.js, and "where prices come from" in sources/.
import { computeBuy, priceStats } from './calc.js';
import { parsePrices, parseMoney } from './parse.js';
import { CONDITIONS } from './ebay-url.js';
import { getPriceSource } from './sources/index.js';
import { BOOKMARKLET } from './bookmarklet-code.js';
import {
  FEE_OPTIONS, loadSettings, saveSettings, loadRecent, addRecent, removeRecent,
  loadDraft, saveDraft,
} from './storage.js';

const CHIP_LIMIT = 12;
const $ = (id) => document.getElementById(id);
const source = getPriceSource();

// ---------- Formatting ----------
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money = (n) => usd.format(n);
// Chips and short labels: drop ".00" but keep real cents.
const short = (n) => (Number.isInteger(n) ? usd0.format(n) : usd.format(n));
const pct = (rate) => `${+(rate * 100).toFixed(1)}%`;
const plainNumber = (n) => (n == null ? '' : String(+n.toFixed(2)));

// ---------- State ----------
let settings = loadSettings();
let state = freshState();
let showAllChips = false;

function freshState() {
  return {
    query: '',
    condition: 'any',
    prices: [],
    ask: '',
    shipMode: 'buyer',
    ship: plainNumber(settings.defaultShip),
  };
}

function restore(saved) {
  const s = freshState();
  if (!saved || typeof saved !== 'object') return s;
  return {
    query: typeof saved.query === 'string' ? saved.query : s.query,
    condition: saved.condition in CONDITIONS ? saved.condition : s.condition,
    prices: Array.isArray(saved.prices) ? saved.prices.filter((p) => typeof p === 'number' && p > 0) : [],
    ask: saved.ask == null ? '' : String(saved.ask),
    shipMode: saved.shipMode === 'free' ? 'free' : 'buyer',
    ship: saved.ship == null ? s.ship : String(saved.ship),
  };
}

function update(changes, { syncInputs = false } = {}) {
  Object.assign(state, changes);
  saveDraft(state);
  if (syncInputs) syncInputsFromState();
  render();
}

// ---------- Rendering ----------
function syncInputsFromState() {
  $('query').value = state.query;
  $('ask').value = state.ask;
  $('ship').value = state.ship;
}

function render() {
  renderSearch();
  renderChips();
  renderStats();
  renderResult();
}

const inStandaloneApp = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function renderSearch() {
  const q = state.query.trim();
  const link = $('ebay-link');
  for (const btn of $('condition').querySelectorAll('button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.value === state.condition));
  }
  if (q) {
    const url = source.searchUrl(q, state.condition);
    // From the home-screen app, a normal link opens in a mini browser that has no
    // bookmarks. googlechromes:// hands the page to Chrome, where "Grab prices" lives.
    const useChrome = inStandaloneApp() && isIOS();
    link.href = useChrome ? url.replace(/^https:/, 'googlechromes:') : url;
    $('ebay-link-here').href = url;
    link.removeAttribute('aria-disabled');
    $('ebay-fallback').hidden = !useChrome;
  } else {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    $('ebay-fallback').hidden = true;
  }
  $('ebay-hint').hidden = Boolean(q);

  const fetchBtn = $('fetch-prices');
  fetchBtn.hidden = !source.canFetch;
  fetchBtn.disabled = !q;
}

function renderChips() {
  const box = $('chips');
  box.replaceChildren();
  const { prices } = state;
  const visible = showAllChips ? prices.length : Math.min(prices.length, CHIP_LIMIT);
  for (let i = 0; i < visible; i++) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.index = i;
    chip.setAttribute('aria-label', `Remove ${money(prices[i])}`);
    chip.innerHTML = '<span></span><span class="x" aria-hidden="true">×</span>';
    chip.firstChild.textContent = short(prices[i]);
    box.appendChild(chip);
  }
  if (prices.length > CHIP_LIMIT) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'chip chip-more';
    more.dataset.action = 'toggle-more';
    more.textContent = showAllChips ? 'Show fewer' : `+${prices.length - CHIP_LIMIT} more`;
    box.appendChild(more);
  }
  $('clear-prices').hidden = prices.length === 0;
}

function renderStats() {
  const s = priceStats(state.prices);
  $('stats').hidden = !s;
  if (!s) return;
  $('stat-median').textContent = money(s.median);
  $('stat-average').textContent = money(s.average);
  $('stat-range').textContent = s.low === s.high ? short(s.low) : `${short(s.low)}–${short(s.high)}`;
  $('stat-count').textContent = String(s.count);
}

function currentResult() {
  return computeBuy({
    prices: state.prices,
    feeRate: settings.feeRate,
    targetPercent: settings.targetPercent,
    ship: parseMoney(state.ship) ?? 0,
    freeShipping: state.shipMode === 'free',
    ask: parseMoney(state.ask),
  });
}

function renderResult() {
  for (const btn of $('ship-mode').querySelectorAll('button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.value === state.shipMode));
  }
  const r = currentResult();
  const tag = $('tag');
  const verdict = $('verdict');
  const table = $('breakdown');
  $('save-check').disabled = !r;

  if (!r) {
    tag.classList.add('is-empty');
    $('tag-price').textContent = '—';
    $('tag-note').textContent = 'Add sold prices to see what to pay.';
    verdict.hidden = true;
    table.hidden = true;
    return;
  }

  tag.classList.remove('is-empty');
  // Round DOWN on the tag so it never tells Dad to pay a little too much.
  const tagAmount = Math.max(0, Math.floor(r.maxBuy));
  $('tag-price').textContent = usd0.format(tagAmount);
  $('tag-note').textContent = r.maxBuy <= 0
    ? `Even free, this won’t make your ${settings.targetPercent}% goal.`
    : `to make ${settings.targetPercent}% profit on a ${short(r.sale)} sale`;

  if (r.verdict) {
    const profit = money(Math.abs(r.profit));
    const texts = {
      buy: ['Buy it', r.returnPercent == null
        ? `About ${profit} profit.`
        : `About ${profit} profit (${Math.round(r.returnPercent)}% return on ${money(r.ask)}).`],
      thin: ['Thin margin', `About ${profit} profit, but less than your ${settings.targetPercent}% goal.`],
      pass: ['Pass', r.profit < 0 ? `You’d lose about ${profit}.` : 'You’d only break even.'],
    };
    const [title, detail] = texts[r.verdict];
    verdict.className = `verdict ${r.verdict}`;
    verdict.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = title;
    const span = document.createElement('span');
    span.textContent = detail;
    verdict.append(strong, span);
    verdict.hidden = false;
  } else {
    verdict.hidden = true;
  }

  const rows = [
    ['Typical sold price', `median of ${r.stats.count}`, money(r.sale)],
    ['eBay fees', `${pct(r.feeRate)} of ${money(r.orderTotal)} + ${money(r.orderFee)}`, '−' + money(r.fees)],
    r.freeShipping
      ? ['Shipping', 'you pay (free shipping)', '−' + money(r.shipOutOfPocket)]
      : ['Shipping', `buyer pays ${money(r.ship)}`, money(0)],
    ['Your profit goal', `${settings.targetPercent}% of ${money(r.sale)}`, '−' + money(r.profitGoal)],
    ['Pay up to', null, money(Math.max(0, r.maxBuy)), 'total'],
  ];
  if (r.ask != null) {
    rows.push(['Asking price', null, money(r.ask)]);
    const profitText = r.profit < 0 ? '−' + money(-r.profit) : money(r.profit);
    rows.push(['Estimated profit', 'sale − fees − shipping − asking price', profitText]);
  }
  const body = table.tBodies[0];
  body.replaceChildren();
  for (const [label, note, value, cls] of rows) {
    const tr = body.insertRow();
    if (cls) tr.className = cls;
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    if (note) {
      const small = document.createElement('small');
      small.textContent = note;
      th.appendChild(small);
    }
    const td = document.createElement('td');
    td.textContent = value;
    tr.append(th, td);
  }
  table.hidden = false;
}

// ---------- Recent checks ----------
function renderRecent(list = loadRecent()) {
  const ul = $('recent-list');
  ul.replaceChildren();
  $('recent-empty').hidden = list.length > 0;
  const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  for (const check of list) {
    const li = document.createElement('li');
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'recent-open';
    open.dataset.id = check.id;
    const title = document.createElement('span');
    title.className = 'recent-title';
    title.textContent = check.query || 'Untitled';
    const meta = document.createElement('span');
    meta.className = 'recent-meta';
    const max = document.createElement('span');
    max.className = 'recent-max';
    max.textContent = `Pay up to ${usd0.format(Math.max(0, Math.floor(check.maxBuy ?? 0)))}`;
    const cond = CONDITIONS[check.condition]?.label ?? 'Any';
    const when = check.date ? dateFmt.format(new Date(check.date)) : '';
    meta.append(max, ` · ${cond} · ${check.prices.length} sold · ${when}`);
    open.append(title, meta);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'recent-remove';
    remove.dataset.remove = check.id;
    remove.setAttribute('aria-label', `Remove ${check.query || 'check'}`);
    remove.textContent = '×';
    li.append(open, remove);
    ul.appendChild(li);
  }
}

function saveCheck() {
  const r = currentResult();
  if (!r) return;
  const list = addRecent({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(),
    query: state.query.trim(),
    condition: state.condition,
    prices: [...state.prices],
    ask: parseMoney(state.ask),
    shipMode: state.shipMode,
    ship: parseMoney(state.ship) ?? 0,
    maxBuy: Math.round(r.maxBuy * 100) / 100,
  });
  renderRecent(list);
  const btn = $('save-check');
  btn.textContent = 'Saved ✓';
  setTimeout(() => { btn.textContent = 'Save to recent checks'; }, 1600);
}

function openCheck(id) {
  const check = loadRecent().find((c) => c.id === id);
  if (!check) return;
  showAllChips = false;
  state = restore({
    ...check,
    ask: check.ask == null ? '' : plainNumber(check.ask),
    ship: plainNumber(check.ship),
  });
  update({}, { syncInputs: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Prices ----------
function addPricesFrom(text) {
  const found = parsePrices(text);
  if (!found.length) return false;
  update({ prices: [...state.prices, ...found] });
  return true;
}

function addFromBox() {
  const input = $('price-input');
  if (addPricesFrom(input.value)) input.value = '';
  input.focus();
}

// ---------- Settings ----------
function renderSettings() {
  const select = $('fee-rate');
  select.replaceChildren(...FEE_OPTIONS.map((o) => new Option(o.label, String(o.rate))));
  select.value = String(settings.feeRate);
  $('default-ship').value = plainNumber(settings.defaultShip);
  $('target').value = plainNumber(settings.targetPercent);
}

let savedTimer;
function changeSettings(changes) {
  settings = { ...settings, ...changes };
  const ok = saveSettings(settings);
  const note = $('settings-saved');
  note.textContent = ok ? 'Saved.' : 'Couldn’t save on this phone; using it for now.';
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { note.textContent = ''; }, 1800);
  render();
}

// ---------- Clipboard (Copy code) ----------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const box = $('code-box');
    box.focus();
    box.select();
    box.setSelectionRange(0, text.length);
    try { return document.execCommand('copy'); } catch { return false; }
  }
}

// ---------- Events ----------
function bind() {
  $('query').addEventListener('input', (e) => update({ query: e.target.value }));
  $('query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  });

  $('condition').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-value]');
    if (btn) update({ condition: btn.dataset.value });
  });

  $('ebay-link').addEventListener('click', (e) => {
    if (!state.query.trim()) {
      e.preventDefault();
      $('query').focus();
    }
  });

  $('fetch-prices').addEventListener('click', async () => {
    const status = $('fetch-status');
    status.hidden = false;
    status.textContent = 'Looking up sold prices…';
    try {
      const prices = await source.fetchPrices(state.query.trim(), state.condition);
      update({ prices: [...state.prices, ...prices] });
      status.textContent = prices.length ? `Added ${prices.length} prices.` : 'No sold prices found.';
    } catch (err) {
      status.textContent = err.message;
    }
  });

  $('add-prices').addEventListener('click', addFromBox);
  $('price-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addFromBox(); }
  });
  // A paste adds the prices right away: no extra tap needed.
  $('price-input').addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text');
    if (text && addPricesFrom(text)) e.preventDefault();
  });

  $('chips').addEventListener('click', (e) => {
    const chip = e.target.closest('button');
    if (!chip) return;
    if (chip.dataset.action === 'toggle-more') {
      showAllChips = !showAllChips;
      renderChips();
      return;
    }
    const i = Number(chip.dataset.index);
    update({ prices: state.prices.filter((_, k) => k !== i) });
  });

  $('clear-prices').addEventListener('click', () => {
    if (state.prices.length > 3 && !confirm(`Clear all ${state.prices.length} prices?`)) return;
    showAllChips = false;
    update({ prices: [] });
  });

  $('ask').addEventListener('input', (e) => update({ ask: e.target.value }));
  $('ship').addEventListener('input', (e) => update({ ship: e.target.value }));
  $('ship-mode').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-value]');
    if (btn) update({ shipMode: btn.dataset.value });
  });

  $('save-check').addEventListener('click', saveCheck);

  $('recent-list').addEventListener('click', (e) => {
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      renderRecent(removeRecent(remove.dataset.remove));
      return;
    }
    const open = e.target.closest('.recent-open');
    if (open) openCheck(open.dataset.id);
  });

  $('new-check').addEventListener('click', () => {
    if (state.prices.length && !confirm('Start a new check? This clears the current one.')) return;
    showAllChips = false;
    state = freshState();
    update({}, { syncInputs: true });
    $('price-input').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('query').focus();
  });

  $('fee-rate').addEventListener('change', (e) => changeSettings({ feeRate: Number(e.target.value) }));
  $('default-ship').addEventListener('change', (e) => {
    const n = parseMoney(e.target.value);
    if (n == null) { e.target.value = plainNumber(settings.defaultShip); return; }
    changeSettings({ defaultShip: n });
  });
  $('target').addEventListener('change', (e) => {
    const n = parseMoney(e.target.value);
    if (n == null || n >= 100) { e.target.value = plainNumber(settings.targetPercent); return; }
    changeSettings({ targetPercent: n });
  });

  $('code-box').value = BOOKMARKLET;
  // Dragged onto Chrome's bookmarks bar on the Mac, this link becomes the bookmark.
  const drag = $('grab-drag');
  drag.href = BOOKMARKLET;
  drag.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Drag this button onto the bookmarks bar instead of clicking it.');
  });
  $('copy-code').addEventListener('click', async () => {
    const ok = await copyText(BOOKMARKLET);
    $('copy-status').textContent = ok
      ? 'Copied! Now follow the steps below.'
      : 'Couldn’t copy automatically. Press and hold the code in the box below, tap Select All, then Copy.';
  });
}

// ---------- Start ----------
if (location.hash === '#grabber') $('grabber').open = true;
state = restore(loadDraft());
bind();
renderSettings();
syncInputsFromState();
render();
renderRecent();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
