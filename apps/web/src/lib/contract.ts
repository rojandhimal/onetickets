// Auth API contract the web app expects from apps/api (S0-3).
// Proposed to BackendDev; move to @onetickets/shared once both sides agree.
//
// The browser calls these through the /api rewrite, so paths here have no /api prefix.
//
// POST /auth/magic-link          body MagicLinkRequest   -> 202, no body, for known and unknown
//                                 emails alike. 422 { field, message } for a bad email or name;
//                                 429 when rate limited. organiserName is sent by sign-up and
//                                 omitted by sign-in: the api uses it only when it creates a new
//                                 organiser and ignores it for an existing one. A new organiser
//                                 with no name gets the part of their email before the @.
// POST /auth/magic-link/verify   body MagicLinkVerify    -> 200 and sets the session cookie
//                                 410 when the link has expired or was already used
// GET  /auth/google/start?organiserName=...              -> 302 to Google; the callback sets the
//                                 session cookie and 302s to /organiser (or /signin?error=google).
//                                 organiserName is optional: a new organiser without one gets
//                                 their Google display name.
// GET  /me                                               -> 200 Session, or 401 when signed out

export type MagicLinkRequest = {
  email: string;
  organiserName?: string;
};

export type MagicLinkVerify = {
  token: string;
};

export type Session = {
  user: {
    id: string;
    email: string;
    /** From Google, or null for email sign-ups until they add one. */
    name: string | null;
  };
  organisation: {
    id: string;
    name: string;
  };
};

export type FieldError = {
  field: keyof MagicLinkRequest;
  message: string;
};
