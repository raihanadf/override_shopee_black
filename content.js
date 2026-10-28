// on by default so the page never flashes orange, then sync with the saved toggle
const root = document.documentElement;
root.setAttribute("data-noir", "");

function apply(enabled) {
  if (enabled === false) root.removeAttribute("data-noir");
  else root.setAttribute("data-noir", "");
}

browser.storage.local.get("enabled").then((saved) => apply(saved.enabled));

browser.storage.onChanged.addListener((changes) => {
  if (changes.enabled) apply(changes.enabled.newValue);
});

// product data captured by hook.js, keyed by "shopid.itemid"
const items = new Map();

window.addEventListener("message", (e) => {
  if (e.source !== window || e.data?.noir !== "items") return;
  for (const item of e.data.items) items.set(`${item.shopid}.${item.itemid}`, item);
  paint();
});

// swaps every product card's contents for three lines: name, shop, price
function paint() {
  const money = (raw, currency) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(raw / 100000);

  for (const card of document.querySelectorAll("a[href]:not([data-noir-card])")) {
    const ids = card.getAttribute("href").match(/-i\.(\d+)\.(\d+)|\/product\/(\d+)\/(\d+)/);
    if (!ids) continue;
    const item = items.get(ids[1] ? `${ids[1]}.${ids[2]}` : `${ids[3]}.${ids[4]}`);
    if (!item) continue;

    const badge = item.is_official_shop ? "Mall" : item.is_preferred_plus_seller ? "Star+" : item.shopee_verified ? "Star" : "";
    const discounted = item.price_before_discount > item.price;

    const box = document.createElement("div");
    box.className = "noir-card";
    box.innerHTML = `
      <div class="noir-name"></div>
      <div class="noir-shop"><span></span><em></em></div>
      <div class="noir-price"><b></b><s></s><i></i></div>`;
    box.querySelector(".noir-name").textContent = item.name;
    box.querySelector(".noir-shop span").textContent = item.shop_name || "N/A";
    box.querySelector(".noir-price b").textContent = money(item.price, item.currency);

    if (badge) box.querySelector("em").textContent = badge;
    else box.querySelector("em").remove();

    if (discounted) {
      box.querySelector("s").textContent = money(item.price_before_discount, item.currency);
      box.querySelector("i").textContent = `-${Math.round((1 - item.price / item.price_before_discount) * 100)}%`;
    } else {
      box.querySelector("s").remove();
      box.querySelector("i").remove();
    }

    card.setAttribute("data-noir-card", "");
    card.append(box);
  }
}

// shopee renders cards lazily and after the api call, so repaint on dom changes too
let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    paint();
  });
}).observe(document, { childList: true, subtree: true });
