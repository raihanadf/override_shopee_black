const saved = { enabled: true, dark: false };
const label = (key) => (document.querySelector(`#${key} .state`).textContent = saved[key] ? "On" : "Off");

browser.storage.local.get(["enabled", "dark"]).then((stored) => {
  saved.enabled = stored.enabled !== false;
  saved.dark = stored.dark === true;
  label("enabled");
  label("dark");
});

for (const key of ["enabled", "dark"]) {
  document.getElementById(key).addEventListener("click", () => {
    saved[key] = !saved[key];
    label(key);
    browser.storage.local.set({ [key]: saved[key] });
  });
}
