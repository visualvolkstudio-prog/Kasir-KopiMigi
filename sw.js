const CACHE_NAME = "kasir-migi-v41";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/offline.html",
  "/assets/favicon-migi.png",
  "/assets/logo-migi.svg",
  "/assets/logo-migi-print.png",
  "/assets/logo-migi.png",
  "/assets/logo-miginew.png",
  "/assets/logo-miginew-transparent.png",
  "/assets/logo-paw.png",
  "/assets/logo-paw-blue-transparent.png",
  "/assets/pwa-icon-192.png",
  "/assets/pwa-icon-512.png",
  "/photobooth/",
  "/photobooth/index.html",
  "/photobooth/style.css",
  "/photobooth/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html"))),
    );
    return;
  }

  if (["/", "/app.js", "/styles.css", "/index.html"].includes(new URL(request.url).pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (new URL(request.url).pathname.startsWith("/assets/")) {
        return caches.match(request, { ignoreSearch: true }).then((assetCached) => assetCached || fetch(request));
      }
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
