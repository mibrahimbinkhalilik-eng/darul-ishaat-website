const CACHE_NAME = "darul-ishaat-v5";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json"
];

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

  // Stale-while-revalidate for everything: HTML, JS, CSS, manifest,
  // images, fonts, icons alike. Serve the cached copy immediately (fast,
  // works even on a very slow or unstable connection), while always also
  // fetching a fresh copy in the background to update the cache for next
  // time. cache:'no-store' on that background fetch bypasses the
  // browser's own HTTP cache layer so a Cache-Control header from the
  // host can't quietly serve a stale response there either.
  //
  // This replaces an earlier network-first/no-store strategy for HTML
  // that forced every single visit to fully re-download the page from
  // the network before showing anything — on a slow connection that
  // could take minutes, during which the page would sit there half
  // loaded (this is what caused a reported "catalogue stays blank"
  // issue). Page freshness across deploys is still handled by the
  // separate, faster mechanism in index.html: it explicitly checks for
  // a new service worker on every open and every hour, and auto-reloads
  // once a new one takes over — so updates still land promptly without
  // holding every visit hostage to a live fetch first.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req, { cache: 'no-store' }).then((response) => {
          if (response && response.ok) cache.put(req, response.clone());
          return response;
        }).catch(() => cached || (req.mode === "navigate" ? caches.match("./index.html") : undefined));
        return cached || network;
      })
    )
  );
});
