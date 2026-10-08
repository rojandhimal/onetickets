import type { FieldError, MagicLinkRequest } from './contract';

export type RequestLinkResult =
  | { ok: true }
  | { ok: false; kind: 'field'; error: FieldError }
  | { ok: false; kind: 'rate-limited' }
  | { ok: false; kind: 'failed' };

export async function requestMagicLink(input: MagicLinkRequest): Promise<RequestLinkResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, kind: 'failed' };
  }
  if (res.ok) return { ok: true };
  if (res.status === 429) return { ok: false, kind: 'rate-limited' };
  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as FieldError | null;
    if (body && (body.field === 'email' || body.field === 'organiserName')) {
      return { ok: false, kind: 'field', error: body };
    }
  }
  return { ok: false, kind: 'failed' };
}

// The session arrives as a cookie; the body isn't needed, so an empty one can't stall sign-in.
export type VerifyResult = { ok: true } | { ok: false; kind: 'expired' | 'failed' };

export async function verifyMagicLink(token: string): Promise<VerifyResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth/magic-link/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    return { ok: false, kind: 'failed' };
  }
  if (res.ok) return { ok: true };
  if (res.status === 410 || res.status === 400) return { ok: false, kind: 'expired' };
  return { ok: false, kind: 'failed' };
}

export function googleStartUrl(organiserName: string): string {
  const name = organiserName.trim();
  return name
    ? `/api/auth/google/start?organiserName=${encodeURIComponent(name)}`
    : '/api/auth/google/start';
}
