import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DRAFT_MAX_AGE_MS,
  clearDeviceDrafts,
  defaultDraftStore,
  memoryDraftStore,
} from './draft-store';

const DAY = 24 * 60 * 60 * 1000;

afterEach(() => clearDeviceDrafts());

describe('defaultDraftStore (IndexedDB)', () => {
  it('gives back what the same organiser kept', async () => {
    await defaultDraftStore('u_1').put('evt_1', { name: 'From the bus' });
    expect(await defaultDraftStore('u_1').get('evt_1')).toEqual({ name: 'From the bus' });
  });

  it("wipes the device when someone else's drafts are on it", async () => {
    await defaultDraftStore('u_1').put('evt_1', { name: 'Mine' });
    expect(await defaultDraftStore('u_2').get('evt_1')).toBeNull();
    // Gone for the first organiser too: the whole database was deleted.
    expect(await defaultDraftStore('u_1').get('evt_1')).toBeNull();
  });

  it('drops entries older than 7 days', async () => {
    await defaultDraftStore('u_1').put('evt_old', { name: 'Old' });
    await defaultDraftStore('u_1').put('evt_new', { name: 'New' });
    const later = Date.now() + DRAFT_MAX_AGE_MS + DAY;
    const realNow = Date.now;
    Date.now = () => later;
    try {
      const store = defaultDraftStore('u_1');
      expect(await store.get('evt_old')).toBeNull();
      await store.put('evt_new', { name: 'Newer' });
      expect(await store.get('evt_new')).toEqual({ name: 'Newer' });
    } finally {
      Date.now = realNow;
    }
  });

  it('clearDeviceDrafts removes everything', async () => {
    await defaultDraftStore('u_1').put('evt_1', { name: 'Mine' });
    await clearDeviceDrafts();
    expect(await defaultDraftStore('u_1').get('evt_1')).toBeNull();
  });
});

describe('memoryDraftStore', () => {
  it('follows the same ownership and expiry rules', async () => {
    let now = 0;
    const map = new Map<string, unknown>();
    await memoryDraftStore('u_1', () => now, map).put('evt_1', { name: 'Mine' });
    expect(await memoryDraftStore('u_1', () => now, map).get('evt_1')).toEqual({ name: 'Mine' });

    now = DRAFT_MAX_AGE_MS + 1;
    expect(await memoryDraftStore('u_1', () => now, map).get('evt_1')).toBeNull();

    await memoryDraftStore('u_1', () => now, map).put('evt_2', { name: 'Mine' });
    expect(await memoryDraftStore('u_2', () => now, map).get('evt_2')).toBeNull();
    expect(map.size).toBe(0);
  });
});
