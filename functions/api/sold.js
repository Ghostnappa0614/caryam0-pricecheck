// PLACEHOLDER Cloudflare Pages Function (a Worker) served at /api/sold.
// It will hold the paid sold-data API key server-side so it never reaches the phone.
//
// To finish it later:
//   1. In Cloudflare: Workers & Pages → this project → Settings → Variables and Secrets
//      → add a Secret named SOLDCOMPS_API_KEY.
//   2. Replace the TODO below with the real API call, and return { prices: number[] }.
//   3. Switch ACTIVE_SOURCE in public/js/sources/index.js to 'soldcomps'.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  const condition = url.searchParams.get('condition') || 'any';

  if (!query) return json({ error: 'Type a model number or item name first.' }, 400);
  if (!['any', 'used', 'new', 'parts'].includes(condition)) {
    return json({ error: 'Unknown condition.' }, 400);
  }
  if (!env.SOLDCOMPS_API_KEY) {
    return json({ error: 'Automatic price lookup is not set up yet.' }, 501);
  }

  // TODO: call the sold-data API with env.SOLDCOMPS_API_KEY, e.g.
  //   const res = await fetch(`https://<provider>/...?q=${encodeURIComponent(query)}`, {
  //     headers: { Authorization: `Bearer ${env.SOLDCOMPS_API_KEY}` },
  //   });
  //   const data = await res.json();
  //   return json({ prices: data.items.map((i) => i.soldPrice) });
  return json({ error: 'Automatic price lookup is not built yet.' }, 501);
}
