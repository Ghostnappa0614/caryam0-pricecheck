// Everything saved on the phone lives here. localStorage can throw (private
// browsing, storage full, blocked site data), so every access is wrapped.

const KEYS = {
  settings: 'caryam0.settings.v1',
  recent: 'caryam0.recent.v1',
  draft: 'caryam0.draft.v1',
};
export const MAX_RECENT = 25;

export const FEE_OPTIONS = [
  { rate: 0.127, label: '12.7% — Basic store or higher' },
  { rate: 0.136, label: '13.6% — No store or Starter store' },
  { rate: 0.153, label: '15.3% — Books, movies & music' },
  { rate: 0.067, label: '6.7% — Guitars & basses' },
];

export const DEFAULT_SETTINGS = {
  feeRate: 0.127,
  defaultShip: 15,
  targetPercent: 30, // placeholder until Dad picks his real number
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

export function loadSettings() {
  const s = read(KEYS.settings, {}) || {};
  return {
    feeRate: FEE_OPTIONS.some((o) => o.rate === s.feeRate) ? s.feeRate : DEFAULT_SETTINGS.feeRate,
    defaultShip: isNum(s.defaultShip) && s.defaultShip >= 0 ? s.defaultShip : DEFAULT_SETTINGS.defaultShip,
    targetPercent: isNum(s.targetPercent) && s.targetPercent >= 0 && s.targetPercent < 100
      ? s.targetPercent : DEFAULT_SETTINGS.targetPercent,
  };
}

export const saveSettings = (settings) => write(KEYS.settings, settings);

export function loadRecent() {
  const list = read(KEYS.recent, []);
  return Array.isArray(list) ? list.filter((c) => c && Array.isArray(c.prices)) : [];
}

// Adds a check to the top of the list and keeps only the newest MAX_RECENT.
export function addRecent(check) {
  const list = [check, ...loadRecent()].slice(0, MAX_RECENT);
  write(KEYS.recent, list);
  return list;
}

export function removeRecent(id) {
  const list = loadRecent().filter((c) => c.id !== id);
  write(KEYS.recent, list);
  return list;
}

// The check in progress, so nothing is lost if the phone reloads the tab
// while Dad is over on eBay.
export const loadDraft = () => read(KEYS.draft, null);
export const saveDraft = (draft) => write(KEYS.draft, draft);
