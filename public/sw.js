/* Hybrid caching service worker:
   - HTML/navigation: network-first — page is always fresh when online
     (matches the old site's "never serve stale HTML" goal), still works offline.
   - Hashed Vite bundles (/assets/) and script thumbnails: cache-first —
     these files are content-addressed or renamed on change, so repeat
     visitors (especially mobile) stop re-downloading megabytes of images. */
const CACHE = 'xlam-hub-v3';

// Immutable-by-convention paths: safe to serve from cache forever.
const CACHE_FIRST = /\/(assets|scripts|icons)\//;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ),
      // Let the browser start navigation requests in parallel with SW boot
      self.registration.navigationPreload?.enable(),
    ]).then(() => self.clients.claim())
  );
});

function fetchAndCache(request, preload) {
  const network = preload
    ? preload.then((hit) => hit || fetch(request))
    : fetch(request);
  return network.then((response) => {
    if (response.ok && new URL(request.url).origin === self.location.origin) {
      const clone = response.clone();
      // Navigations are keyed without the query string: ?s=/?q= variants all
      // serve the same SPA shell, so one entry covers every deep link.
      const key = request.mode === 'navigate' ? stripSearch(request.url) : request;
      caches.open(CACHE).then((cache) => cache.put(key, clone));
    }
    return response;
  });
}

function stripSearch(u) {
  const url = new URL(u);
  url.search = '';
  return url.href;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  const url = new URL(request.url);
  const immutable = url.origin === self.location.origin && CACHE_FIRST.test(url.pathname);

  event.respondWith(
    immutable
      ? caches.match(request).then((hit) => hit || fetchAndCache(request))
      : fetchAndCache(request, event.preloadResponse).catch(() =>
          caches
            .match(request.mode === 'navigate' ? stripSearch(request.url) : request)
            .then((hit) => hit || Response.error())
        )
  );
});
