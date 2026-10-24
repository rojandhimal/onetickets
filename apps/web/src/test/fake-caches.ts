/** An in-memory Cache Storage for unit tests: enough of `caches` for the ticket screen. */
export function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const path = (input: RequestInfo | URL) =>
    new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href)
      .pathname;

  function cache(store: Map<string, Response>): Cache {
    return {
      put: async (input: RequestInfo | URL, res: Response) => void store.set(path(input), res),
      match: async (input: RequestInfo | URL) => store.get(path(input))?.clone(),
      delete: async (input: RequestInfo | URL) => store.delete(path(input)),
      keys: async () => [...store.keys()].map((p) => new Request(new URL(p, location.href))),
    } as unknown as Cache;
  }

  const storage = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      return cache(stores.get(name)!);
    },
    has: async (name: string) => stores.has(name),
    delete: async (name: string) => stores.delete(name),
    match: async (input: RequestInfo | URL, options?: { cacheName?: string }) => {
      const names = options?.cacheName ? [options.cacheName] : [...stores.keys()];
      for (const name of names) {
        const hit = stores.get(name)?.get(path(input));
        if (hit) return hit.clone();
      }
      return undefined;
    },
    keys: async () => [...stores.keys()],
  };
  return { storage: storage as unknown as CacheStorage, stores };
}
