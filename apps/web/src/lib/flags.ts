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
