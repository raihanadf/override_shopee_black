// on by default so the page never flashes orange, then sync with the saved toggle
const root = document.documentElement;
root.setAttribute("data-noir", "");

function apply(saved) {
  if ("enabled" in saved) root.toggleAttribute("data-noir", saved.enabled !== false);
  if ("dark" in saved) root.toggleAttribute("data-noir-dark", saved.dark === true);
}

browser.storage.local.get(["enabled", "dark"]).then(apply);

browser.storage.onChanged.addListener((changes) => {
  apply(Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue])));
});

// image cdn and currency per shopee country, picked from the site's domain
const SITES = {
  "co.id": ["id", "IDR"],
  sg: ["sg", "SGD"],
  "com.my": ["my", "MYR"],
  ph: ["ph", "PHP"],
  vn: ["vn", "VND"],
  "co.th": ["th", "THB"],
  tw: ["tw", "TWD"],
  "com.br": ["br", "BRL"],
};
const [cdn, currency] = Object.entries(SITES).find(([tld]) => location.hostname.endsWith(`shopee.${tld}`))[1];

// finds the shallowest value under any of the keys, since shopee moves fields around between endpoints
function pick(node, keys) {
  const queue = [node];
  while (queue.length) {
    const next = queue.shift();
    for (const key of keys) if (next[key] !== undefined && next[key] !== null && next[key] !== "") return next[key];
    for (const value of Object.values(next)) if (value && typeof value === "object") queue.push(value);
  }
}

const SORTS = [
  ["Relevant", "relevancy"],
  ["Latest", "ctime"],
  ["Top sales", "sales"],
];

// the page we draw on top of shopee's home and search pages; shopee keeps running underneath
const shell = document.createElement("div");
shell.id = "noir";
shell.innerHTML = `
  <header>
    <button class="noir-plus" aria-label="Search">+</button>
    <nav></nav>
    <a class="noir-bag" href="/cart" aria-label="Cart">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M5 8h14l-1 12H6L5 8z" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>
      </svg>
    </a>
  </header>
  <form class="noir-search"><input name="q" placeholder="Search" autocomplete="off"></form>
  <main></main>
  <footer></footer>`;
root.append(shell);

const grid = shell.querySelector("main");
let items = [];
let route = "";
let painted = "";

shell.querySelector(".noir-plus").addEventListener("click", () => {
  shell.classList.toggle("searching");
  shell.querySelector("input").focus();
});

shell.querySelector("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = shell.querySelector("input").value.trim();
  if (q) location.href = `/search?keyword=${encodeURIComponent(q)}`;
});

// shopee only lazy-loads more home items when its own page scrolls, so nudge it when we near the bottom
shell.addEventListener("scroll", () => {
  if (shell.scrollTop + shell.clientHeight > shell.scrollHeight - 800) window.scrollTo(0, document.body.scrollHeight);
});

window.addEventListener("message", (e) => {
  if (e.source !== window || e.data?.noir !== "items") return;
  const search = location.pathname === "/search";
  if (search && !e.data.url.includes("search_items")) return;

  // a new search response or a new page means a fresh list, home keeps appending
  const now = location.pathname + location.search;
  if (search || now !== route) items = [];
  route = now;

  const seen = new Set(items.map((item) => item.itemid));
  for (const raw of e.data.items) {
    const item = {
      itemid: raw.itemid,
      shopid: raw.shopid,
      name: pick(raw, ["name", "title"]),
      image: pick(raw, ["image"]),
      price: pick(raw, ["price", "price_min"]),
      before: pick(raw, ["price_before_discount", "strikethrough_price", "price_min_before_discount"]),
      shop: pick(raw, ["shop_name"]),
      badge: pick(raw, ["is_official_shop"]) ? "Mall" : pick(raw, ["is_preferred_plus_seller"]) ? "Star+" : pick(raw, ["shopee_verified"]) ? "Star" : "",
    };
    // ids without a name, photo and price are vouchers, shops or ads, not something to list
    if (!item.name || !item.image || !item.price || seen.has(item.itemid)) continue;
    seen.add(item.itemid);
    items.push(item);
  }
  render();
});

// draws header, grid and footer for the current page, only touching the dom when something changed
function render() {
  const listing = location.pathname === "/" || location.pathname === "/search";
  root.toggleAttribute("data-noir-list", listing);
  if (!listing) return;

  // the home feed only loads once shopee's own page scrolls down to it
  if (location.pathname === "/" && !items.length) window.scrollTo(0, root.scrollHeight);

  // navigated inside shopee's app: drop the old page's items until its response lands
  if (location.pathname + location.search !== route) {
    route = location.pathname + location.search;
    items = [];
  }

  const params = new URLSearchParams(location.search);
  const key = `${location.pathname}${location.search}|${items.length}`;
  if (key === painted) return;
  painted = key;

  const money = (raw) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(raw / 100000);
  const link = (label, href, active) => {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = href;
    if (active) a.className = "active";
    return a;
  };

  const nav = shell.querySelector("nav");
  if (location.pathname === "/search") {
    const sort = params.get("sortBy") || "relevancy";
    nav.replaceChildren(
      ...SORTS.map(([label, value]) => {
        const next = new URLSearchParams(params);
        next.set("sortBy", value);
        next.delete("page");
        return link(label, `/search?${next}`, value === sort);
      }),
    );
  } else {
    nav.replaceChildren(link("For you", "/", true));
  }

  const footer = shell.querySelector("footer");
  footer.replaceChildren(link("Cart", "/cart"), link("Orders", "/user/purchase"), link("Account", "/user/account/profile"));
  if (location.pathname === "/search") {
    const page = Number(params.get("page") || 0);
    const at = (n) => {
      const next = new URLSearchParams(params);
      next.set("page", n);
      return `/search?${next}`;
    };
    if (page > 0) footer.prepend(link("Prev", at(page - 1)));
    footer.append(link("Next", at(page + 1)));
  }

  grid.replaceChildren(
    ...items.map((item) => {
      const card = document.createElement("a");
      card.className = "noir-item";
      card.href = `/product/${item.shopid}/${item.itemid}`;
      card.innerHTML = `
        <div class="noir-img"><img loading="lazy" alt=""></div>
        <div class="noir-name"></div>
        <div class="noir-price"><b></b><s></s><i></i></div>
        <div class="noir-shop"><span></span><em></em></div>`;

      card.querySelector("img").src = item.image.startsWith("http") ? item.image : `https://down-${cdn}.img.susercontent.com/file/${item.image}`;
      card.querySelector(".noir-name").textContent = item.name;
      card.querySelector(".noir-price b").textContent = money(item.price);
      card.querySelector(".noir-shop span").textContent = item.shop || "N/A";

      if (item.badge) card.querySelector("em").textContent = item.badge;
      else card.querySelector("em").remove();

      if (item.before > item.price) {
        card.querySelector("s").textContent = money(item.before);
        card.querySelector("i").textContent = `-${Math.round((1 - item.price / item.before) * 100)}%`;
      } else {
        card.querySelector("s").remove();
        card.querySelector("i").remove();
      }
      return card;
    }),
  );
}

// shopee is a single page app, so watch the dom for route changes
let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    render();
  });
}).observe(root, { childList: true, subtree: true });
render();
