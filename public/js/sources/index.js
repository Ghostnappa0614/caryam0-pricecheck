// THE SEAM: the rest of the app asks this file for "the price source" and never
// cares where prices come from. Every source has the same shape:
//
//   {
//     id, label,
//     canFetch: boolean,                       // true = app shows a "Get sold prices" button
//     searchUrl(query, condition) -> string,   // link to eBay's sold listings
//     fetchPrices(query, condition) -> Promise<number[]>   // only used when canFetch
//   }
//
// To switch to the paid API later: finish functions/api/sold.js, set the
// SOLDCOMPS_API_KEY secret in Cloudflare, and change ACTIVE_SOURCE below.
import manual from './manual.js';
import soldcomps from './soldcomps.js';

const SOURCES = { manual, soldcomps };
const ACTIVE_SOURCE = 'manual';

export function getPriceSource() {
  return SOURCES[ACTIVE_SOURCE];
}
