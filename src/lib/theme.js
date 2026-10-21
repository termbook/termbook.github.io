// Theme toggle. The first paint is handled by the inline script in each page's <head>.
const key = "tb-theme";
export function initTheme(btn) {
  const apply = (t) => { document.documentElement.dataset.theme = t; btn.setAttribute("aria-pressed", String(t === "dark")); btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode"); btn.textContent = t === "dark" ? "☀" : "☾"; };
  apply(document.documentElement.dataset.theme || "light");
  btn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(key, next); } catch (e) {}
    apply(next);
  });
}
