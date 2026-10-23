// Service worker for the attendee ticket screen (S2-3, ADR 0020). Registered with scope /tickets/,
// so it only ever controls ticket pages. The page itself saves what it needs into Cache Storage
// (lib/tickets.ts, saveForOffline); this worker only answers from that cache when the network
// can't. Nothing else on the site is touched.

const CACHE = 'onetickets-tickets-v1';
// Set by the page on each saved order (lib/tickets.ts, savedUntil): when it stops being served.
const EXPIRES = 'x-onetickets-expires';

const ORDER_TICKETS = /^\/api\/public\/orders\/([^/]+)\/tickets$/;

const expired = (response) => {
  const at = Date.parse(response.headers.get(EXPIRES) ?? '');
  return Number.isNaN(at) || at <= Date.now();
};

/** Drops saved orders past their date, with their pages; if that empties it, the cache too. */
async function dropExpiredOrders() {
  if (!(await caches.has(CACHE))) return;
  const cache = await caches.open(CACHE);
  let left = 0;
  let dropped = 0;
  for (const request of await cache.keys()) {
    const match = ORDER_TICKETS.exec(new URL(request.url).pathname);
    if (!match) continue;
    const saved = await cache.match(request);
    if (saved && !expired(saved)) {
      left += 1;
      continue;
    }
    await cache.delete(request);
    await cache.delete(`/tickets/${match[1]}`, { ignoreSearch: true });
    dropped += 1;
  }
  // Only after dropping the last order: a page may be saving its first one right now.
  if (dropped && !left) await caches.delete(CACHE);
}

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
      await dropExpiredOrders().catch(() => undefined);
      await self.clients.claim();
    })(),
  );
});

/** Live first, so a revoked ticket or a changed time shows; the saved copy only without signal. */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(request, { cacheName: CACHE, ignoreSearch: true });
    if (cached && !(ORDER_TICKETS.test(new URL(request.url).pathname) && expired(cached))) {
      return cached;
    }
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
