// FitPlanner Service Worker
// Provides offline support and makes the app installable as a PWA.
// CACHE_NAME: bump this version whenever icons or assets change so the
// service worker discards the old cache and re-fetches everything fresh.
const CACHE_NAME = "fitplanner-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-16.png",
  "./icons/icon-32.png",
  "./icons/icon-48.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon.ico",
];

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - For Supabase API calls: network only (don't cache user data API)
// - For external CDNs (React, Babel, Supabase SDK): cache-first with network fallback
// - For app shell (HTML, icons, manifest): cache-first
// - Other: network-first with cache fallback
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Don't cache Supabase API calls — always go to network
  if (url.hostname.endsWith(".supabase.co")) {
    return; // let browser handle normally
  }

  // For navigation requests, serve the cached index.html if offline
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // For everything else: cache-first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache successful GET responses
        if (response && response.ok && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
