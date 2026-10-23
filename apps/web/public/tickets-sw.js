// Service worker for the attendee ticket screen (S2-3, ADR 0020). Registered with scope /tickets/,
// so it only ever controls ticket pages. The page itself saves what it needs into Cache Storage
// (lib/tickets.ts, saveForOffline); this worker only answers from that cache when the network
// can't. Nothing else on the site is touched.

const CACHE = 'onetickets-tickets-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('onetickets-tickets-') && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

const ORDER_TICKETS = /^\/api\/public\/orders\/[^/]+\/tickets$/;

/** Live first, so a revoked ticket or a changed time shows; the saved copy only without signal. */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(request, { cacheName: CACHE, ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

/** Built files never change under the same name, so the saved copy is as good as the network. */
async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: CACHE });
  return cached ?? fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && url.pathname.startsWith('/tickets/')) {
    event.respondWith(networkFirst(request));
  } else if (ORDER_TICKETS.test(url.pathname)) {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  }
});
