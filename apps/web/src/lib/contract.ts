// Auth API contract agreed with BackendDev for S0-3. BackendDev moves these types to
// @onetickets/shared (packages/shared/src/api/auth.ts) in the api PR; switch imports then.
//
// The browser calls these through the /api rewrite, so paths here have no /api prefix.
// POSTs send Content-Type: application/json and come from the web origin (the api checks
// Origin). Errors always have the ApiError shape.
//
// POST /auth/magic-link          { email, organiserName? } -> 202 for known and unknown emails
//                                 alike. organiserName is only used for a new email and is
//                                 never sent by this web app: new organisers name their
//                                 organisation after signing in (PM decision, 8 Oct).
//                                 422 invalid_request (field), 429 rate_limited.
//                                 Emails a link to ${WEB_URL}/auth/verify#token=..., single use,
//                                 valid 15 minutes.
// POST /auth/magic-link/verify   { token } -> 200 Session and sets the session cookie.
//                                 410 link_expired | link_used | link_invalid.
// GET  /auth/google/start         -> 302 to Google; the callback sets the cookie and 302s to
//                                 /organiser, or to /signin?error=google.
// GET  /me                        -> 200 Session, or 401 not_signed_in.
// POST /organisations            { name } -> 201 Organisation. 422 invalid_request (field 'name').
// POST /auth/sign-out            -> 204, revokes the session server-side.

export type MagicLinkRequest = {
  email: string;
  organiserName?: string;
};

export type Role = 'owner' | 'admin' | 'finance' | 'door_staff';

export type Organisation = {
  id: string;
  name: string;
  role: Role;
};

export type Session = {
  user: {
    id: string;
    email: string;
    /** From Google, or null for email sign-ups. */
    name: string | null;
    mfaEnabled: boolean;
  };
  /** The current organisation, or null for someone signed in with no organisation yet. */
  organisation: Organisation | null;
  organisations: Organisation[];
};

export type ApiError = {
  statusCode: number;
  code: string;
  message: string;
  field?: string;
};
