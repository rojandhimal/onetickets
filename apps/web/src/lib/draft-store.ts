import type { EventDraftPatch } from '@onetickets/shared';

// Unsaved wizard changes kept on the device while offline, synced when the connection returns.
// Holds only what the organiser typed into their own draft; nothing here is sent anywhere else.

export type PendingChanges = Omit<EventDraftPatch, 'version'>;

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

const indexedDbStore: DraftStore = {
  async get(eventId) {
    return ((await withStore('readonly', (s) => s.get(eventId))) as PendingChanges) ?? null;
  },
  async put(eventId, changes) {
    await withStore('readwrite', (s) => s.put(changes, eventId));
  },
  async remove(eventId) {
    await withStore('readwrite', (s) => s.delete(eventId));
  },
};

/** For browsers without IndexedDB (private modes, tests): changes live only as long as the tab. */
export function memoryDraftStore(): DraftStore {
  const map = new Map<string, PendingChanges>();
  return {
    get: async (id) => map.get(id) ?? null,
    put: async (id, changes) => void map.set(id, changes),
    remove: async (id) => void map.delete(id),
  };
}

export function defaultDraftStore(): DraftStore {
  return typeof indexedDB === 'undefined' ? memoryDraftStore() : indexedDbStore;
}
