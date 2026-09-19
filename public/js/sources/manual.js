// Current price source: Dad opens eBay's sold listings himself and pastes the
// prices back (usually via the "Grab prices" bookmark). Nothing is fetched.
import { soldListingsUrl } from '../ebay-url.js';

export default {
  id: 'manual',
  label: 'eBay sold listings (you paste the prices)',
  canFetch: false,
  searchUrl: (query, condition) => soldListingsUrl(query, condition),
  async fetchPrices() {
    throw new Error('The manual source does not fetch prices.');
  },
};
