// Shared by the server pages that read ?error= and the client form that shows it.
// Kept out of the 'use client' module so server components can call it.

export type InitialError = 'google' | 'google_unverified' | 'google_unavailable' | 'link';

const INITIAL_ERRORS: readonly InitialError[] = [
  'google',
  'google_unverified',
  'google_unavailable',
  'link',
];

/** Maps ?error= to a known message. Anything else is ignored, never echoed. */
export function parseInitialError(value: string | undefined): InitialError | null {
  return INITIAL_ERRORS.find((e) => e === value) ?? null;
}
