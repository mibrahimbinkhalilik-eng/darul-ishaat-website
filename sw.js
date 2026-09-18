const CACHE_NAME = "darul-ishaat-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json"
];

// File extensions that rarely change once published — safe to cache-first.
const STATIC_ASSET_RE = /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (!req.url.startsWith(self.location.origin)) return;

  const isNavigation = req.mode === "navigate";
  const isStaticAsset = STATIC_ASSET_RE.test(req.url);

  if (isNavigation || !isStaticAsset) {
    // Network-first: HTML, JS, CSS, manifest — always get the latest deploy.
    // Falls back to cache only when offline.
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
  } else {
    // Cache-first: images, fonts, icons — fast repeat loads, rarely change.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        });
      })
    );
  }
});
