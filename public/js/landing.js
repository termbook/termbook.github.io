import { initTheme } from "/js/theme.js";
initTheme(document.getElementById("theme"));
const header = document.querySelector(".site-header");
const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
addEventListener("scroll", onScroll, { passive: true }); onScroll();
const menu = document.getElementById("menu"), links = document.getElementById("links");
menu.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});
links.addEventListener("click", (e) => { if (e.target.closest("a")) { links.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); } });
addEventListener("keydown", (e) => { if (e.key === "Escape" && links.classList.contains("open")) { links.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); menu.focus(); } });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
