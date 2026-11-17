// Minimal service worker: app-shell/static caching + offline fallback.
// Never caches HTML pages, RSC payloads, API routes, Supabase calls or server actions
// (those are always network-only so authenticated data is never stored).
const VERSION = "v1";
const STATIC_CACHE = `clinic-static-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { credentials: "omit" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname === "/apple-icon.png" ||
  url.pathname === "/favicon.ico";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // server actions / form posts: network only
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase etc.: network only

  // Navigations: network only; show the offline page if the network fails.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
    return;
  }

  // Static, non-authenticated assets: network first, cache as fallback for offline use.
  if (isStaticAsset(url) && !req.headers.has("RSC")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) ?? Response.error()),
    );
  }
  // Everything else (RSC payloads, /auth, API): untouched, network only.
});
