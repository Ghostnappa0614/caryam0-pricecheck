// Builds eBay's sold-listings search URL.
export const CONDITIONS = {
  any: { label: 'Any', code: null },
  used: { label: 'Used', code: 3000 },
  new: { label: 'New', code: 1000 },
  parts: { label: 'For parts', code: 7000 },
};

export function soldListingsUrl(query, condition = 'any') {
  let url = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(query.trim()) +
    '&LH_Sold=1&LH_Complete=1&_sop=13';
  const code = CONDITIONS[condition]?.code;
  if (code) url += '&LH_ItemCondition=' + code;
  return url;
}
