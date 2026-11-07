import type { AttendeeOrdersDto, AttendeeSession, OrderTicketsDto } from '@onetickets/shared';

export type RequestAttendeeLinkResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; message: string }
  | { ok: false; kind: 'rate-limited' | 'failed' | 'challenge' | 'unavailable' };

export type VerifyAttendeeLinkResult =
  { ok: true; session: AttendeeSession } | { ok: false; kind: 'expired' | 'failed' };

export async function requestAttendeeLink(
  email: string,
  turnstileToken?: string,
): Promise<RequestAttendeeLinkResult> {
  try {
    const res = await fetch('/api/attendee/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, turnstileToken }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) return { ok: false, kind: 'rate-limited' };
    if (res.status === 403 || res.status === 503) {
      const body = (await res.json().catch(() => null)) as { code?: string } | null;
      if (body?.code === 'challenge_failed') return { ok: false, kind: 'challenge' };
      if (body?.code === 'challenge_unavailable') return { ok: false, kind: 'unavailable' };
    }
    if (res.status === 422) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (body?.message) return { ok: false, kind: 'invalid', message: body.message };
    }
    return { ok: false, kind: 'failed' };
  } catch {
    return { ok: false, kind: 'failed' };
  }
}

export async function verifyAttendeeLink(token: string): Promise<VerifyAttendeeLinkResult> {
  try {
    const res = await fetch('/api/attendee/magic-link/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      const session = (await res.json()) as AttendeeSession;
      return { ok: true, session };
    }
    if (res.status === 410) return { ok: false, kind: 'expired' };
    return { ok: false, kind: 'failed' };
  } catch {
    return { ok: false, kind: 'failed' };
  }
}

export async function fetchAttendeeSession(): Promise<AttendeeSession | null> {
  try {
    const res = await fetch('/api/attendee/session', {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (res.ok) return (await res.json()) as AttendeeSession;
    return null;
  } catch {
    return null;
  }
}

export async function signOutAttendee(): Promise<void> {
  try {
    await fetch('/api/attendee/sign-out', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch {
    // Ignore network error on sign-out
  }
}

export async function fetchAttendeeOrders(): Promise<OrderTicketsDto[]> {
  const allOrders: OrderTicketsDto[] = [];
  let cursor: string | null = null;
  do {
    const url: string = cursor
      ? `/api/attendee/orders?after=${encodeURIComponent(cursor)}`
      : '/api/attendee/orders';
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) break;
    const data = (await res.json()) as AttendeeOrdersDto;
    allOrders.push(...data.orders);
    cursor = data.nextCursor;
  } while (cursor);
  return allOrders;
}

export function splitOrders(
  orders: OrderTicketsDto[],
  now = new Date(),
): { upcoming: OrderTicketsDto[]; past: OrderTicketsDto[] } {
  const nowMs = now.getTime();
  const upcoming: OrderTicketsDto[] = [];
  const past: OrderTicketsDto[] = [];

  for (const order of orders) {
    const endMs = new Date(order.event.endsAt).getTime();
    if (endMs >= nowMs) {
      upcoming.push(order);
    } else {
      past.push(order);
    }
  }

  upcoming.sort(
    (a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime(),
  );

  past.sort((a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime());

  return { upcoming, past };
}
