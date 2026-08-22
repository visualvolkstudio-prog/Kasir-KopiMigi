const CACHE_NAME = "kasir-migi-v158";
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
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => null);
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html"))),
    );
    return;
  }

  const url = new URL(request.url);
  if (["/", "/app.js", "/styles.css", "/index.html"].includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => null);
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => null);
          }
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => null);
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
