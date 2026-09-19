// "Grab prices" bookmarklet — readable source.
// Run `npm run build:bookmarklet` after editing; it minifies this into a
// javascript: URL and writes it to public/js/bookmarklet-code.js.
//
// RULE: the built code must not contain the "hash" or "percent" characters,
// because they break when pasted into a bookmark's URL field. So: no hex
// colors (use rgb()), no percent units, no modulo operator. The build fails
// if either character sneaks in.
(function () {
  var CARD_ID = 'caryam0-grab-card';
  var old = document.getElementById(CARD_ID);
  if (old) old.remove();

  // ---- 1. Read the sold prices ------------------------------------------
  var nodes = document.querySelectorAll(
    'li.s-item, li.s-card, ul.srp-results > li, [class*=REWRITE_START]'
  );
  var prices = [];
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    var cls = typeof el.className === 'string' ? el.className : '';
    // "Results matching fewer words" — everything after this is a looser match.
    if (cls.indexOf('REWRITE_START') !== -1) break;

    var title = el.querySelector('.s-item__title, .s-card__title');
    if (title && title.textContent.indexOf('Shop on eBay') !== -1) continue;

    var priceEl = el.querySelector('.s-item__price, .s-card__price');
    if (!priceEl) continue;
    // First dollar amount; for a range like "$20.00 to $35.00" that is the low end.
    var m = priceEl.textContent.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    if (!m) continue;
    var n = parseFloat(m[1].replace(/,/g, ''));
    if (n > 0) prices.push(n);
  }

  // ---- 2. Summarize -------------------------------------------------------
  var sorted = prices.slice().sort(function (a, b) { return a - b; });
  var count = sorted.length;
  var mid = count >> 1;
  var median = count ? ((count & 1) ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : 0;
  var sum = 0;
  for (var j = 0; j < count; j++) sum += sorted[j];
  var average = count ? sum / count : 0;
  var money = function (v) {
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var text = prices.map(function (p) { return String(p); }).join(' ');

  // ---- 3. Show the card ---------------------------------------------------
  var card = document.createElement('div');
  card.id = CARD_ID;
  card.setAttribute('data-prices', text);
  card.setAttribute('role', 'dialog');
  card.style.cssText = [
    'position:fixed', 'left:8px', 'right:8px', 'bottom:8px', 'z-index:2147483647',
    'background:rgb(255,222,89)', 'color:rgb(20,20,20)', 'border:3px solid rgb(20,20,20)',
    'border-radius:18px', 'box-shadow:0 8px 30px rgba(0,0,0,.45)',
    'padding:16px 16px calc(16px + env(safe-area-inset-bottom))',
    'font:18px/1.35 -apple-system,system-ui,Helvetica,Arial,sans-serif',
    'max-width:560px', 'margin:0 auto', 'text-align:left',
  ].join(';');

  function line(tag, css, content) {
    var e = document.createElement(tag);
    e.style.cssText = css;
    e.textContent = content;
    card.appendChild(e);
    return e;
  }

  if (!count) {
    line('div', 'font-weight:800;font-size:22px;margin-bottom:6px', 'No sold prices found');
    line('div', 'margin-bottom:12px',
      location.href.indexOf('LH_Sold=1') === -1
        ? 'This does not look like an eBay sold-listings page. Open it from the pricer app first.'
        : 'Wait for the page to finish loading, then try again.');
  } else {
    line('div', 'font-weight:700;font-size:17px', 'Found ' + count + ' sold price' + (count === 1 ? '' : 's'));
    line('div', 'font-weight:800;font-size:40px;line-height:1.1;margin:2px 0 4px', 'Typical ' + money(median));
    line('div', 'font-size:17px', 'Average ' + money(average));
    line('div', 'font-size:17px;margin-bottom:12px', 'Range ' + money(sorted[0]) + ' to ' + money(sorted[count - 1]));
  }

  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px';
  card.appendChild(row);

  function button(label, dark) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'flex:1;min-height:56px;border-radius:12px;font:700 19px/1 -apple-system,system-ui,sans-serif;' +
      'border:2px solid rgb(20,20,20);cursor:pointer;' +
      (dark ? 'background:rgb(20,20,20);color:rgb(255,255,255)' : 'background:rgb(255,255,255);color:rgb(20,20,20)');
    row.appendChild(b);
    return b;
  }

  if (count) {
    var copyBtn = button('Copy prices', true);
    copyBtn.onclick = function () {
      var done = function () { copyBtn.textContent = 'Copied! Paste in the pricer'; };
      var fallback = function () {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        ta.remove();
        if (ok) done();
        else window.prompt('Copy these prices:', text);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    };
  }
  button('Close', false).onclick = function () { card.remove(); };

  document.body.appendChild(card);
})();
