# Caryam0 Price Check

A phone web app for checking eBay **sold** prices in a store aisle and deciding
what to pay. Plain HTML/CSS/JS: no framework, no build step for the app itself.

## Try it on this Mac

Open a **new** Terminal window (so it picks up Node), then:

```bash
cd ~/Documents/"Caryam0 Pricing App"/"Web App"
npm start
```

Open <http://localhost:8080>. Stop it with `Ctrl+C`.

## Try it on the iPhone (before deploying)

1. The iPhone and the Mac must be on the **same Wi-Fi**.
2. Run `npm start`. It prints a line like `On the iPhone (same Wi-Fi): http://192.168.1.23:8080`.
3. Type that address into Chrome on the iPhone. If macOS asks whether to allow
   "node" to accept incoming connections, click **Allow**.

Everything works this way except the offline cache (service worker), which
needs a real `https://` address. It turns on automatically once deployed.

## Tests

```bash
npm test                    # calculator math, price parsing, eBay links, bookmarklet
npm run build:bookmarklet   # after editing bookmarklet/grab.js
npm run icons               # after editing scripts/make-icons.mjs
```

The bookmarklet test runs the built bookmarklet against
`test/fixtures/ebay-sold-pioneer-sx780.html`, a real saved eBay sold-results
page. If eBay changes its page layout and the grabber stops finding prices, save a
fresh sold-results page from desktop Chrome (**File → Save Page As…**) into
`test/fixtures/`, point a test at it, and fix `bookmarklet/grab.js` until it passes.

## How the code is organized

| File | What it does |
| --- | --- |
| `public/index.html`, `public/styles.css` | The one screen |
| `public/js/app.js` | Connects the screen to everything below |
| `public/js/calc.js` | Buy-calculator math (median, fees, "pay up to", verdict) |
| `public/js/parse.js` | Turns pasted text into prices (`$1,250.00` stays one number) |
| `public/js/storage.js` | Settings, recent checks (last 25), and the check in progress |
| `public/js/ebay-url.js` | eBay sold-listings link + condition codes |
| `public/js/sources/` | **Where prices come from.** See below |
| `public/js/bookmarklet-code.js` | Generated. Don't edit; run `npm run build:bookmarklet` |
| `bookmarklet/grab.js` | Readable source of the "Grab prices" bookmark |
| `functions/api/sold.js` | Placeholder server function for a paid sold-data API |

### Swapping in a paid price source later

The app only ever calls `getPriceSource()` in `public/js/sources/index.js`.
Today that returns `manual.js` (Dad pastes prices). To switch to a paid API:

1. Finish the TODO in `functions/api/sold.js`. It must return `{ "prices": [ ... ] }`.
2. In Cloudflare, add a **Secret** named `SOLDCOMPS_API_KEY` (Workers & Pages →
   your project → Settings → Variables and Secrets). The key stays on Cloudflare's
   server and never reaches the phone.
3. Change `ACTIVE_SOURCE` in `sources/index.js` to `'soldcomps'`. A
   **Get sold prices** button appears in step 1.

### The calculator

- sale = median of sold prices
- Buyer pays shipping: fees = (sale + ship) × feeRate + perOrderFee
- Free shipping: fees = sale × feeRate + perOrderFee, and Dad pays the shipping
- perOrderFee = $0.40 if the order total is over $10, else $0.30
- pay up to = sale − fees − (free shipping ? ship : 0) − sale × profit goal
- With an asking price: profit = sale − fees − (free shipping ? ship : 0) − ask.
  "Buy it" if ask ≤ pay-up-to, "Thin margin" if still profitable, otherwise "Pass".
- The tag rounds **down** to the whole dollar; the breakdown shows cents.

## Putting it online (Cloudflare Pages), for later

You don't need GitHub. These steps upload the folder straight from this Mac.

1. **Make a Cloudflare account.** Go to <https://dash.cloudflare.com/sign-up>, sign up
   with your email, and verify it. The free plan is all you need.
2. **Log in from Terminal.** In a new Terminal window:
   ```bash
   cd ~/Documents/"Caryam0 Pricing App"/"Web App"
   npx wrangler login
   ```
   A browser tab opens; click **Allow**. (The first run asks to install
   `wrangler`; type `y`.)
3. **Upload the site.**
   ```bash
   npx wrangler pages deploy public --project-name caryam0-pricecheck
   ```
   The first time, it asks which branch is "production"; press Enter to accept
   `main`. When it finishes, it prints the address, e.g.
   `https://caryam0-pricecheck.pages.dev`. That address is the app.
   (Running from this folder also uploads `functions/`, so the placeholder
   `/api/sold` goes live too. Until it's finished, it just answers "not set up yet.")
4. **Updating later:** run `npm test`, then the same `deploy` command again.

### Put it on Dad's home screen

1. On his iPhone, open the `https://….pages.dev` address in **Chrome**.
2. Tap the **Share** button (square with an arrow) in the address bar, then
   **Add to Home Screen**, then **Add**.
3. The "Price Check" icon opens the app full-screen. Its **See sold prices on eBay**
   button hands eBay over to Chrome (where the Grab prices bookmark lives). After
   copying prices, switch back to the app by swiping along the bottom edge or using the app switcher.

> The home-screen app keeps its **own** saved settings and recent checks,
> separate from the same page opened in a Chrome tab. Pick one and stick with it.

### Keeping it private (Cloudflare Access), not set up yet

When you're ready: in the Cloudflare dashboard go to **Zero Trust** → **Access** →
**Applications** → **Add an application** → **Self-hosted**, enter the
`caryam0-pricecheck.pages.dev` address, and add a policy that **Allows** the two
of you by email address. Visitors then get a one-time code by email to get in.
Set the session duration long (e.g. 1 month) so Dad isn't asked often. Two things
to check after turning it on: the home-screen app has its own login (it will ask
for a code once), and the app icon/manifest must still load. If the icon breaks,
add `crossorigin="use-credentials"` to the `<link rel="manifest">` tag in `index.html`.
