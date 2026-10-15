import type { EventDraftPatch } from '@onetickets/shared';

// Unsaved wizard changes kept on the device while offline, synced when the connection returns.
// Holds only what the organiser typed into their own draft; nothing here is sent anywhere else.
// Computers get shared, so each entry records who wrote it and when: a different organiser opening
// the wizard wipes the whole database, and entries older than 7 days are dropped (ADR 0016).

export type PendingChanges = Omit<EventDraftPatch, 'version'>;

export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Entry = { userId: string; savedAt: number; changes: PendingChanges };

function isExpired(entry: Entry, now: number): boolean {
  return now - entry.savedAt > DRAFT_MAX_AGE_MS;
}

/** True for anything that isn't a well-formed entry, e.g. one written before entries had owners. */
function isForeign(entry: unknown, userId: string): boolean {
  const e = entry as Partial<Entry> | null;
  return !e || typeof e !== 'object' || e.userId !== userId || typeof e.savedAt !== 'number';
}

export interface DraftStore {
  get(eventId: string): Promise<PendingChanges | null>;
  put(eventId: string, changes: PendingChanges): Promise<void>;
  remove(eventId: string): Promise<void>;
}

const DB_NAME = 'onetickets';
const STORE = 'event-drafts';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return request(fn(db.transaction(STORE, mode).objectStore(STORE)));
}

/** Deletes every draft kept on this device. Call on sign-out. */
export async function clearDeviceDrafts(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await dbPromise?.catch(() => null);
  db?.close();
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    // Blocked by another open tab: it is deleted once that tab closes the connection.
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

/** Wipes the database if anyone else left drafts here, otherwise drops expired entries. */
async function sweep(userId: string, now: number): Promise<void> {
  const entries = await withStore('readonly', (s) => s.getAll());
  if (entries.some((e) => isForeign(e, userId))) return clearDeviceDrafts();
  const keys = await withStore('readonly', (s) => s.getAllKeys());
  const expired = keys.filter((_, i) => isExpired(entries[i] as Entry, now));
  if (expired.length) {
    const db = await openDb();
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    await Promise.all(expired.map((k) => request(store.delete(k))));
  }
}

function indexedDbStore(userId: string, now: () => number): DraftStore {
  let swept: Promise<void> | null = null;
  const ready = () => (swept ??= sweep(userId, now()).catch(() => clearDeviceDrafts()));
  return {
    async get(eventId) {
      await ready();
      const entry = await withStore('readonly', (s) => s.get(eventId));
      if (!entry || isForeign(entry, userId) || isExpired(entry as Entry, now())) return null;
      return (entry as Entry).changes;
    },
    async put(eventId, changes) {
      await ready();
      const entry: Entry = { userId, savedAt: now(), changes };
      await withStore('readwrite', (s) => s.put(entry, eventId));
    },
    async remove(eventId) {
      await withStore('readwrite', (s) => s.delete(eventId));
    },
  };
}

/**
 * For browsers without IndexedDB (private modes) and tests: changes live only as long as the tab.
 * Follows the same ownership and expiry rules as the IndexedDB store.
 */
export function memoryDraftStore(
  userId = 'u_1',
  now: () => number = Date.now,
  map = new Map<string, unknown>(),
): DraftStore {
  return {
    async get(id) {
      if ([...map.values()].some((e) => isForeign(e, userId))) map.clear();
      const entry = map.get(id) as Entry | undefined;
      if (!entry) return null;
      if (isExpired(entry, now())) {
        map.delete(id);
        return null;
      }
      return entry.changes;
    },
    put: async (id, changes) => void map.set(id, { userId, savedAt: now(), changes }),
    remove: async (id) => void map.delete(id),
  };
}

export function defaultDraftStore(userId: string): DraftStore {
  return typeof indexedDB === 'undefined'
    ? memoryDraftStore(userId)
    : indexedDbStore(userId, Date.now);
}
