// FUTURE price source: a paid sold-data API (e.g. SoldComps), called through
// our own server function at /api/sold so the API key never reaches the phone.
// Not active yet — see sources/index.js and functions/api/sold.js.
import { soldListingsUrl } from '../ebay-url.js';

export default {
  id: 'soldcomps',
  label: 'SoldComps (automatic)',
  canFetch: true,
  // Keep the eBay link available so Dad can still eyeball the listings.
  searchUrl: (query, condition) => soldListingsUrl(query, condition),
  async fetchPrices(query, condition) {
    const params = new URLSearchParams({ q: query, condition });
    const res = await fetch('/api/sold?' + params, { credentials: 'same-origin' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Price lookup failed (${res.status}).`);
    // Expected response: { prices: number[] }
    return (body.prices || []).filter((p) => typeof p === 'number' && p > 0);
  },
};
