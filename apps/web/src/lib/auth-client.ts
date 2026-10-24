import type { ApiErrorBody } from '@onetickets/shared';
import { clearDeviceDrafts } from './draft-store';

type Failure =
  { ok: false; kind: 'invalid'; message: string } | { ok: false; kind: 'rate-limited' | 'failed' };

async function post(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

async function failure(res: Response | null): Promise<Failure> {
  if (!res) return { ok: false, kind: 'failed' };
  if (res.status === 429) return { ok: false, kind: 'rate-limited' };
  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    if (body?.message) return { ok: false, kind: 'invalid', message: body.message };
  }
  return { ok: false, kind: 'failed' };
}

export type RequestLinkResult =
  | { ok: true }
  | Failure
  // Turnstile (SEC-10): the check failed, or the api couldn't ask Cloudflare. No link was sent.
  | { ok: false; kind: 'challenge' | 'unavailable' };

/** `turnstileToken` is sent when the page has Turnstile on (SEC-10). */
export async function requestMagicLink(
  email: string,
  turnstileToken?: string,
): Promise<RequestLinkResult> {
  const res = await post('/auth/magic-link', { email, turnstileToken });
  if (res?.ok) return { ok: true };
  if (res?.status === 403 || res?.status === 503) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    if (body?.code === 'challenge_failed') return { ok: false, kind: 'challenge' };
    if (body?.code === 'challenge_unavailable') return { ok: false, kind: 'unavailable' };
  }
  return failure(res);
}

// The session arrives as a cookie; the body isn't needed, so an empty one can't stall sign-in.
export type VerifyResult = { ok: true } | { ok: false; kind: 'expired' | 'failed' };

export async function verifyMagicLink(token: string): Promise<VerifyResult> {
  const res = await post('/auth/magic-link/verify', { token });
  if (!res) return { ok: false, kind: 'failed' };
  if (res.ok) return { ok: true };
  if (res.status === 410) return { ok: false, kind: 'expired' };
  return { ok: false, kind: 'failed' };
}

export type CreateOrganisationResult = { ok: true } | Failure;

export async function createOrganisation(name: string): Promise<CreateOrganisationResult> {
  const res = await post('/organisations', { name });
  return res?.ok ? { ok: true } : failure(res);
}

export const GOOGLE_START_URL = '/api/auth/google/start';

/**
 * Ends the session and wipes what this device keeps (SEC-16). The drafts go even when the api
 * can't be reached, so the next person on a shared computer never sees them; the api's
 * `Clear-Site-Data: "storage"` is the backstop when it can. Resolves `false` when the api didn't
 * confirm, because the session may still be live and the person must not be told they're out.
 */
export async function signOut(): Promise<boolean> {
  const res = await post('/auth/sign-out', {});
  await clearDeviceDrafts().catch(() => undefined);
  return res?.ok ?? false;
}
