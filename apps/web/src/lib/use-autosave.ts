'use client';

import type { EventDraftDto } from '@onetickets/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type DraftStore, type PendingChanges, defaultDraftStore } from './draft-store';
import { saveDraft } from './events-client';

export type SaveState = 'saved' | 'saving' | 'offline';

export const AUTOSAVE_INTERVAL_MS = 10_000;

type Options = {
  event: EventDraftDto;
  /** The server's copy after each save. */
  onSaved?: (event: EventDraftDto) => void;
  /** Changes found on this device from an earlier offline session, before they're synced. */
  onRestore?: (changes: PendingChanges) => void;
  /** The api refused a field; the change is dropped so the rest can still save. */
  onInvalid?: (field: string | undefined, message: string) => void;
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
  onSaved,
  onRestore,
  onInvalid,
  store: storeOption,
  intervalMs = AUTOSAVE_INTERVAL_MS,
}: Options) {
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const id = event.id;
  const organisationId = event.organisationId;
  const store = useRef(storeOption ?? defaultDraftStore()).current;
  const version = useRef(event.version);
  const pending = useRef<PendingChanges>({});
  const inFlight = useRef<Promise<void> | null>(null);
  const callbacks = useRef({ onSaved, onRestore, onInvalid });
  callbacks.current = { onSaved, onRestore, onInvalid };

  const isDirty = () => Object.keys(pending.current).length > 0;

  const keepOnDevice = useCallback(async () => {
    try {
      await store.put(id, pending.current);
    } catch {
      // Storage full or blocked: the changes still sit in memory and retry on the next tick.
    }
    setSaveState('offline');
  }, [id, store]);

  const send = useCallback(
    async (keepalive: boolean) => {
      for (let attempt = 0; attempt < 2 && isDirty(); attempt++) {
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
          if (!isDirty()) {
            await store.remove(id).catch(() => undefined);
            setSaveState('saved');
          }
          return;
        }
        // Newer typing wins over what was in flight.
        pending.current = { ...changes, ...pending.current };
        if (result.kind === 'stale') {
          // Saved elsewhere first: take the new version and resend our changes on top.
          version.current = result.current.version;
          continue;
        }
        if (result.kind === 'invalid') {
          const field = result.field as keyof PendingChanges | undefined;
          if (field && field in pending.current) delete pending.current[field];
          else pending.current = {};
          callbacks.current.onInvalid?.(result.field, result.message);
          if (!isDirty()) setSaveState('saved');
          continue;
        }
        await keepOnDevice();
        return;
      }
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

  const change = useCallback(
    (changes: PendingChanges) => {
      pending.current = { ...pending.current, ...changes };
      if (saveState === 'offline') void keepOnDevice();
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

  return { saveState, change, flush };
}
