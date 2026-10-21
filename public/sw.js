// Stage 0 service worker: caches the app shell so it opens offline.
const CACHE = "termbook-shell-v2";
const SHELL = ["/", "/app/", "/css/tokens.css", "/css/base.css", "/css/landing.css", "/css/app.css", "/privacy.html", "/terms.html", "/js/theme.js", "/js/theme-init.js", "/js/landing.js", "/favicon.svg", "/assets/icons/logo.svg", "/manifest.webmanifest", "/assets/fonts/plus-jakarta-sans-latin-400-normal.woff2", "/assets/fonts/plus-jakarta-sans-latin-600-normal.woff2", "/assets/fonts/plus-jakarta-sans-latin-800-normal.woff2", "/assets/fonts/young-serif-latin-400-normal.woff2"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  if (r.mode === "navigate") { e.respondWith(fetch(r).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); return res; }).catch(() => caches.match(r).then((m) => m || caches.match("/app/")))); return; }
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); return res; })));
});
