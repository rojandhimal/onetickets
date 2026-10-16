import type {
  ApiErrorBody,
  EventDraftDto,
  EventDraftPatch,
  PlaceSuggestionDto,
  PublishNotReadyBody,
  StaleDraftBody,
  VenueInput,
} from '@onetickets/shared';

// Browser calls for the create-event wizard. Same-origin /api, so the session cookie rides along.

/** Organiser event routes are nested under the organisation; the api's access checks need it. */
export type EventRef = Pick<EventDraftDto, 'id' | 'organisationId'>;

function eventPath({ id, organisationId }: EventRef): string {
  return `/organisations/${encodeURIComponent(organisationId)}/events/${encodeURIComponent(id)}`;
}

/** null means the request never reached the api (offline, DNS, aborted). */
async function call(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(`/api${path}`, {
      ...init,
      headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
    });
  } catch {
    return null;
  }
}

async function json<T>(res: Response): Promise<T | null> {
  return (await res.json().catch(() => null)) as T | null;
}

export type CreateEventResult = { ok: true; event: EventDraftDto } | { ok: false };

export async function createEvent(
  organisationId: string,
  template: EventDraftDto['template'],
): Promise<CreateEventResult> {
  const res = await call(`/organisations/${encodeURIComponent(organisationId)}/events`, {
    method: 'POST',
    body: JSON.stringify({ template }),
  });
  const event = res?.ok ? await json<EventDraftDto>(res) : null;
  return event ? { ok: true, event } : { ok: false };
}

export type SaveDraftResult =
  | { ok: true; event: EventDraftDto }
  /** Someone (another tab, an offline sync) saved first. `current` is the server's copy. */
  | { ok: false; kind: 'stale'; current: EventDraftDto }
  | { ok: false; kind: 'offline' }
  | { ok: false; kind: 'invalid'; field?: string; message: string; code?: string }
  | { ok: false; kind: 'failed' };

export async function saveDraft(
  ref: EventRef,
  patch: EventDraftPatch,
  opts: { keepalive?: boolean } = {},
): Promise<SaveDraftResult> {
  const res = await call(eventPath(ref), {
    method: 'PATCH',
    body: JSON.stringify(patch),
    keepalive: opts.keepalive,
  });
  if (!res) return { ok: false, kind: 'offline' };
  if (res.ok) {
    const event = await json<EventDraftDto>(res);
    return event ? { ok: true, event } : { ok: false, kind: 'failed' };
  }
  if (res.status === 409) {
    const body = await json<StaleDraftBody>(res);
    if (body?.current?.id) return { ok: false, kind: 'stale', current: body.current };
  }
  if (res.status === 422) {
    const body = await json<ApiErrorBody>(res);
    if (body?.message)
      return {
        ok: false,
        kind: 'invalid',
        field: body.field,
        message: body.message,
        code: body.code,
      };
  }
  return { ok: false, kind: 'failed' };
}

export type PublishResult =
  | { ok: true; event: EventDraftDto }
  | { ok: false; kind: 'not-ready'; missing: PublishNotReadyBody['missing'] }
  | { ok: false; kind: 'failed' };

export async function publishEvent(ref: EventRef): Promise<PublishResult> {
  const res = await call(`${eventPath(ref)}/publish`, { method: 'POST' });
  if (res?.ok) {
    const event = await json<EventDraftDto>(res);
    if (event) return { ok: true, event };
  }
  if (res?.status === 422) {
    const body = await json<PublishNotReadyBody>(res);
    if (body?.code === 'not_ready') return { ok: false, kind: 'not-ready', missing: body.missing };
  }
  return { ok: false, kind: 'failed' };
}

export async function searchPlaces(
  q: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestionDto[] | null> {
  const res = await call(`/places/search?${new URLSearchParams({ q })}`, { signal });
  if (!res?.ok) return null;
  return (await json<{ items: PlaceSuggestionDto[] }>(res))?.items ?? null;
}

export async function getPlace(placeId: string): Promise<VenueInput | null> {
  const res = await call(`/places/${encodeURIComponent(placeId)}`);
  return res?.ok ? json<VenueInput>(res) : null;
}

export type BannerResult =
  | { ok: true; event: EventDraftDto }
  | { ok: false; kind: 'too-large' | 'wrong-type' | 'offline' | 'failed' };

/** Uploads the image itself as the request body; the api crops, re-encodes and strips metadata. */
export async function uploadBanner(ref: EventRef, file: Blob): Promise<BannerResult> {
  const res = await call(`${eventPath(ref)}/banner`, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  return bannerResult(res);
}

export async function removeBanner(ref: EventRef): Promise<BannerResult> {
  return bannerResult(await call(`${eventPath(ref)}/banner`, { method: 'DELETE' }));
}

async function bannerResult(res: Response | null): Promise<BannerResult> {
  if (!res) return { ok: false, kind: 'offline' };
  if (res.ok) {
    const event = await json<EventDraftDto>(res);
    return event ? { ok: true, event } : { ok: false, kind: 'failed' };
  }
  if (res.status === 413) return { ok: false, kind: 'too-large' };
  if (res.status === 415 || res.status === 422) return { ok: false, kind: 'wrong-type' };
  return { ok: false, kind: 'failed' };
}
