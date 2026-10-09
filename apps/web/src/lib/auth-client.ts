import type { ApiError } from './contract';

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
    const body = (await res.json().catch(() => null)) as ApiError | null;
    if (body?.message) return { ok: false, kind: 'invalid', message: body.message };
  }
  return { ok: false, kind: 'failed' };
}

export type RequestLinkResult = { ok: true } | Failure;

export async function requestMagicLink(email: string): Promise<RequestLinkResult> {
  const res = await post('/auth/magic-link', { email });
  return res?.ok ? { ok: true } : failure(res);
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
