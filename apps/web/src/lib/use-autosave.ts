'use client';

import type { EventDraftDto } from '@onetickets/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type DraftStore, type PendingChanges, defaultDraftStore } from './draft-store';
import { saveDraft } from './events-client';

/** `failed`: online, but the api didn't take the save. Changes stay queued and retry. */
export type SaveState = 'saved' | 'saving' | 'offline' | 'failed';

export const AUTOSAVE_INTERVAL_MS = 10_000;

type Options = {
  event: EventDraftDto;
  /** The signed-in organiser; changes kept on the device belong to them alone. */
  userId: string;
  /** The server's copy after each save. */
  onSaved?: (event: EventDraftDto) => void;
  /** Changes found on this device from an earlier offline session, before they're synced. */
  onRestore?: (changes: PendingChanges) => void;
  /** The api refused a field; the change is dropped so the rest can still save. */
  onInvalid?: (field: string | undefined, message: string, code?: string) => void;
  store?: DraftStore;
  intervalMs?: number;
};

/**
 * Autosave for the create-event wizard (design 8b): queue changes as the organiser types, save on
 * blur and at least every 10 seconds while dirty, and keep them on the device when offline.
 * Typing is never blocked: saving works on a snapshot while new changes queue behind it.
 */
export function useAutosave({
  event,
  userId,
  onSaved,
  onRestore,
  onInvalid,
  store: storeOption,
  intervalMs = AUTOSAVE_INTERVAL_MS,
}: Options) {
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const id = event.id;
  const organisationId = event.organisationId;
  const store = useRef(storeOption ?? defaultDraftStore(userId)).current;
  const version = useRef(event.version);
  const pending = useRef<PendingChanges>({});
  const inFlight = useRef<Promise<void> | null>(null);
  const callbacks = useRef({ onSaved, onRestore, onInvalid });
  callbacks.current = { onSaved, onRestore, onInvalid };

  const isDirty = () => Object.keys(pending.current).length > 0;

  const keepOnDevice = useCallback(
    async (state: 'offline' | 'failed' = 'offline') => {
      try {
        await store.put(id, pending.current);
      } catch {
        // Storage full or blocked: the changes still sit in memory and retry on the next tick.
      }
      setSaveState(state);
    },
    [id, store],
  );

  const send = useCallback(
    async (keepalive: boolean) => {
      // Set when the api refused something it couldn't pin to a field: nothing says "saved" then.
      let refusedWhole = false;
      // A few rounds, so typing that lands during a save goes out straight after it.
      for (let round = 0; round < 4 && isDirty(); round++) {
        const changes = pending.current;
        pending.current = {};
        setSaveState('saving');
        const result = await saveDraft(
          { id, organisationId },
          { version: version.current, ...changes },
          { keepalive },
        );
        if (result.ok) {
          version.current = result.event.version;
          callbacks.current.onSaved?.(result.event);
          continue;
        }
        if (result.kind === 'stale') {
          // Saved elsewhere first: take the new version and resend our changes on top.
          // Newer typing wins over what was in flight.
          version.current = result.current.version;
          pending.current = { ...changes, ...pending.current };
          continue;
        }
        if (result.kind === 'invalid') {
          // Drop only what the api refused, from the snapshot it saw; typing since then stays.
          const field = result.field as keyof PendingChanges | undefined;
          if (field && field in changes) {
            const rest = { ...changes };
            delete rest[field];
            pending.current = { ...rest, ...pending.current };
          } else {
            refusedWhole = true;
          }
          callbacks.current.onInvalid?.(result.field, result.message, result.code);
          continue;
        }
        pending.current = { ...changes, ...pending.current };
        const offline = result.kind === 'offline' || !navigator.onLine;
        await keepOnDevice(offline ? 'offline' : 'failed');
        return;
      }
      if (isDirty()) {
        // Still changing after several rounds: keep it safe and let the next tick carry on.
        await keepOnDevice('failed');
        return;
      }
      await store.remove(id).catch(() => undefined);
      setSaveState(refusedWhole ? 'failed' : 'saved');
    },
    [id, keepOnDevice, organisationId, store],
  );

  const flush = useCallback(
    (opts: { keepalive?: boolean } = {}): Promise<void> => {
      const run = async () => {
        if (inFlight.current) await inFlight.current;
        if (!isDirty()) return;
        const p = send(opts.keepalive ?? false);
        inFlight.current = p;
        try {
          await p;
        } finally {
          if (inFlight.current === p) inFlight.current = null;
        }
      };
      return run();
    },
    [send],
  );

  /** A change the api made outside autosave (a banner upload): take its version. */
  const accept = useCallback((server: EventDraftDto) => {
    if (server.version > version.current) version.current = server.version;
    callbacks.current.onSaved?.(server);
  }, []);

  const change = useCallback(
    (changes: PendingChanges) => {
      pending.current = { ...pending.current, ...changes };
      if (saveState === 'offline' || saveState === 'failed') void keepOnDevice(saveState);
    },
    [keepOnDevice, saveState],
  );

  // Pick up changes left on this device by an earlier offline session.
  useEffect(() => {
    let cancelled = false;
    store
      .get(id)
      .then((saved) => {
        if (cancelled || !saved || Object.keys(saved).length === 0) return;
        pending.current = { ...saved, ...pending.current };
        callbacks.current.onRestore?.(saved);
        void flush();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [flush, id, store]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (isDirty()) void flush();
    }, intervalMs);
    const onOnline = () => void flush();
    const onHide = () => {
      if (document.visibilityState === 'hidden' && isDirty()) {
        void store.put(id, pending.current).catch(() => undefined);
        void flush({ keepalive: true });
      }
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush, id, intervalMs, store]);

  return { saveState, change, flush, accept };
}
