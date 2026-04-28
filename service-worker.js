const CACHE_NAME = "gymcontrol-v27";
const URLS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon-32.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./gymcontrol-logo-source.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const isNavigation = request.mode === "navigate" || acceptsHtml;

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", cloned));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          return cachedPage || caches.match("./index.html");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((response) => {
          if (request.method === "GET" && response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
