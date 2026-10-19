// Весела азбука — офлайн кеш.
// Стратегия: показва веднага кешираното копие и обновява кеша на заден план
// (stale-while-revalidate). Новата версия се вижда при следващото отваряне.
const C = "azbuka-v2";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;

  // Шрифтовете не се променят: кеш, а ако ги няма — мрежа.
  if (isFont) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        const cp = r.clone();
        caches.open(C).then(c => c.put(req, cp));
        return r;
      }))
    );
    return;
  }

  // Страницата и файловете: веднага от кеша, обновяване на заден план.
  const key = req.mode === "navigate" ? "index.html" : req;
  const cacheP = caches.open(C);
  const update = cacheP.then(cache => fetch(req).then(r => {
    if (r && r.ok) return cache.put(key, r.clone()).then(() => r);
    return r;
  }));
  e.waitUntil(update.catch(() => {}));
  e.respondWith(
    cacheP.then(cache => cache.match(key, { ignoreSearch: true }))
      .then(hit => hit || update)
  );
});
