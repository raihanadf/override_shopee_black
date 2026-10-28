// runs in the page itself: watches shopee's own api responses and hands any product objects to content.js
(() => {
  // shopee nests items differently per endpoint, so take anything carrying an item id and shop id
  function walk(node, found) {
    if (!node || typeof node !== "object") return found;
    if (node.itemid && node.shopid) {
      found.push(node);
      return found;
    }
    for (const key in node) walk(node[key], found);
    return found;
  }

  const send = (url, text) => {
    if (!String(url).includes("/api/v4/")) return;
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return;
    }
    const items = walk(json, []);
    console.debug("[noir]", String(url).split("?")[0], items.length, "items", items[0]);
    if (items.length) window.postMessage({ noir: "items", url: String(url), items }, location.origin);
  };

  const fetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await fetch(...args);
    res.clone().text().then((text) => send(res.url, text), () => {});
    return res;
  };

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.addEventListener("load", () => {
      if (this.responseType === "" || this.responseType === "text") send(url, this.responseText);
      else if (this.responseType === "json") send(url, JSON.stringify(this.response));
    });
    return open.call(this, method, url, ...rest);
  };
})();
