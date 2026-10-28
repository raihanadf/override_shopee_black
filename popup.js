const state = document.getElementById("state");
let enabled = true;

browser.storage.local.get("enabled").then((saved) => {
  enabled = saved.enabled !== false;
  state.textContent = enabled ? "On" : "Off";
});

document.getElementById("toggle").addEventListener("click", () => {
  enabled = !enabled;
  state.textContent = enabled ? "On" : "Off";
  browser.storage.local.set({ enabled });
});
