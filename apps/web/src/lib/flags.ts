// Server-side feature flags, read per request so staging and production can differ without a
// rebuild. Unfinished features stay off until their story ships (Definition of Done).

/** S1-1 create-event wizard. Until it's on, the organiser home shows templates as coming soon. */
export function isEventWizardEnabled(): boolean {
  return process.env.FEATURE_EVENT_WIZARD === 'true';
}
