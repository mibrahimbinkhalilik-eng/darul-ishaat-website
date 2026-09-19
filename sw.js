const CACHE_NAME = "darul-ishaat-v3";
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
    // Stale-while-revalidate: images, fonts, icons. Serve the cached copy
    // immediately for a fast repeat load, but ALWAYS also fetch a fresh
    // copy in the background and overwrite the cache entry with it. Plain
    // cache-first (the old strategy) never re-checked the network once an
    // image was cached, so re-uploading a fresh cover photo to the same
    // path (e.g. images/book-367.jpg, the normal way this catalogue's
    // photo-swap workflow works) could stay stale in a returning visitor's
    // cache indefinitely, with no way for it to self-correct. This still
    // shows the cached image on THIS load, but the swap is picked up
    // automatically by the NEXT load instead of requiring the visitor to
    // clear the app's storage.
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((response) => {
            if (response && response.ok) cache.put(req, response.clone());
            return response;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});
