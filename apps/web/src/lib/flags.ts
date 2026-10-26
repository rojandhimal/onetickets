// Server-side feature flags, read per request so staging and production can differ without a
// rebuild. Unfinished features stay off until their story ships (Definition of Done).

/** S1-1 create-event wizard. Until it's on, the organiser home shows templates as coming soon. */
export function isEventWizardEnabled(): boolean {
  return process.env.FEATURE_EVENT_WIZARD === 'true';
}

/**
 * Event pages show the organiser's banner (design 2, `showBanner`). On by default while tegs
 * decides; `false` shows the template colour block instead.
 */
export function isEventBannerShown(): boolean {
  return process.env.FEATURE_EVENT_BANNER !== 'false';
}

/** Booking arrives in Sprint 2. Until then the event page's bar says tickets open soon. */
export function isBookingEnabled(): boolean {
  return process.env.FEATURE_BOOKING === 'true';
}

/**
 * S2-3 ticket screen (`/tickets/:orderId`): the confirmation and ticket stubs. Off until the
 * tickets api and checkout (S2-2) ship.
 */
export function isTicketsEnabled(): boolean {
  return process.env.FEATURE_TICKETS === 'true';
}

/** Pages that carry the Turnstile widget (SEC-10). Only these get Cloudflare in their CSP. */
export const TURNSTILE_PATHS: readonly string[] = ['/signin', '/signup'];

/**
 * SEC-10 Turnstile on sign-in. The site key when it's on, else null. The api checks the token
 * only when it has the matching TURNSTILE_ENABLED and secret, so turn both on together.
 */
export function turnstileSiteKey(): string | null {
  if (process.env.TURNSTILE_ENABLED !== 'true') return null;
  const key = process.env.TURNSTILE_SITE_KEY;
  if (!key) throw new Error('TURNSTILE_ENABLED=true needs TURNSTILE_SITE_KEY');
  return key;
}
