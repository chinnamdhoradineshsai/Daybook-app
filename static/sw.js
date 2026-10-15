/**
 * DAYBOOK Service Worker (PWA & Offline Asset Caching)
 * Caches app shell, stylesheet, icons, and JavaScript companion assets.
 */

const CACHE_NAME = "daybook-v2.3.0-upload-fix";
const ASSETS_TO_CACHE = [
  "/",
  "/static/css/style.css?v=10",
  "/static/js/config.js",
  "/static/js/offline.js?v=4",
  "/static/js/companions.js",
  "/static/js/theme.js?v=6",
  "/static/js/editor.js",
  "/static/js/sounds.js?v=6",
  "/static/js/app.js?v=12",
  "/manifest.json",
];

// Install Event: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[SW] Cache addAll warning:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: cleanup older caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Stale-While-Revalidate for assets, Network-First for API & HTML Navigation
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Navigation / App Root: Network-First so updates show immediately
  if (event.request.mode === "navigate" || url.pathname === "/") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // API Requests: Network-First with cached fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return new Response(
            JSON.stringify({ offline: true, message: "Operating in offline mode" }),
            { headers: { "Content-Type": "application/json" } }
          );
        });
      })
    );
    return;
  }

  // App Shell & Static Assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
