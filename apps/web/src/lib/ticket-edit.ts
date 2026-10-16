import type { EventDraftDto, TicketTypeInput } from '@onetickets/shared';
import { type DraftStore, ticketEditKey } from './draft-store';
import { addTicketType, updateTicketType } from './events-client';

/**
 * Ticket type edits the api hasn't received yet, kept on the device like other wizard changes
 * (ADR 0016), keyed by the type's id or 'new' for one not created yet. `fields` is what the form
 * showed, so reopening the draft shows the edit; `input` is what to send.
 */
export type TicketEdit = { fields: Record<string, string>; input: TicketTypeInput };
export type TicketEdits = Record<string, TicketEdit>;
export type TicketEditStore = DraftStore<TicketEdits>;

const locks = new Map<string, Promise<unknown>>();

/**
 * Runs ticket saves for one event one at a time, across the Tickets step and the wizard, so an
 * edit kept on the device is never sent twice (twice would create a 'new' type twice).
 */
export function withTicketLock<T>(eventId: string, fn: () => Promise<T>): Promise<T> {
  const before = locks.get(eventId) ?? Promise.resolve();
  const run = before.then(fn, fn);
  const settled = run.catch(() => undefined);
  locks.set(eventId, settled);
  void settled.then(() => {
    if (locks.get(eventId) === settled) locks.delete(eventId);
  });
  return run;
}

export async function readTicketEdits(store: TicketEditStore, eventId: string) {
  return (await store.get(ticketEditKey(eventId)).catch(() => null)) ?? {};
}

export async function keepTicketEdit(
  store: TicketEditStore,
  eventId: string,
  targetId: string,
  edit: TicketEdit,
): Promise<void> {
  const edits = await readTicketEdits(store, eventId);
  await store.put(ticketEditKey(eventId), { ...edits, [targetId]: edit }).catch(() => undefined);
}

export async function forgetTicketEdit(
  store: TicketEditStore,
  eventId: string,
  targetId: string,
): Promise<void> {
  const edits = await readTicketEdits(store, eventId);
  if (!(targetId in edits)) return;
  delete edits[targetId];
  const key = ticketEditKey(eventId);
  await (Object.keys(edits).length ? store.put(key, edits) : store.remove(key)).catch(
    () => undefined,
  );
}

export type SyncResult = {
  /** The event after the edits that went through, or null when none did. */
  event: EventDraftDto | null;
  /** True while edits are still waiting on the device (offline, or the api failing). */
  pending: boolean;
};

/**
 * Sends the edits kept on this device, except the one the Tickets step is showing (it sends that
 * itself). Offline or failing, they stay for next time. The api refusing one (a removed type,
 * sold tickets, a rule it breaks) drops it: retrying can't help. Call inside `withTicketLock`.
 */
export async function sendKeptTicketEdits(
  event: EventDraftDto,
  store: TicketEditStore,
  except?: string,
): Promise<SyncResult> {
  const edits = await readTicketEdits(store, event.id);
  let current = event;
  let changed = false;
  for (const [targetId, edit] of Object.entries(edits)) {
    if (targetId === except) continue;
    if (targetId !== 'new' && !current.ticketTypes.some((t) => t.id === targetId)) {
      await forgetTicketEdit(store, event.id, targetId);
      continue;
    }
    const result =
      targetId === 'new'
        ? await addTicketType(current, edit.input)
        : await updateTicketType(current, targetId, edit.input);
    if (result.ok) {
      current = result.event;
      changed = true;
    } else if (result.kind === 'offline' || result.kind === 'failed') {
      return { event: changed ? current : null, pending: true };
    }
    await forgetTicketEdit(store, event.id, targetId);
  }
  const left = Object.keys(await readTicketEdits(store, event.id)).filter((k) => k !== except);
  return { event: changed ? current : null, pending: left.length > 0 };
}

export function syncTicketEdits(event: EventDraftDto, store: TicketEditStore) {
  return withTicketLock(event.id, () => sendKeptTicketEdits(event, store));
}
