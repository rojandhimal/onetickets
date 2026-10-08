import { z } from 'zod';
import type { OrganisationDto } from './organisations.js';

/**
 * Sign-in API contract (S0-3), agreed with the web app. Paths have no /api prefix; the web
 * app reaches them through its /api rewrite so the session cookie is first-party.
 *
 * POST /auth/magic-link          MagicLinkRequest -> 202, no body. Same answer for any email.
 * POST /auth/magic-link/verify   MagicLinkVerify  -> 200 Session + session cookie;
 *                                410 link_expired | link_used | link_invalid
 * GET  /auth/google/start?organiserName=&returnTo=  -> 302 to Google; the callback 302s to
 *                                WEB_URL + returnTo (relative paths only) with the cookie set,
 *                                or to /signin?error=google | google_unverified | google_unavailable
 * GET  /me                       -> 200 Session, or 401 not_signed_in
 * POST /auth/sign-out            -> 204, session revoked server-side
 *
 * Every error is ApiErrorBody. Validation is 422 invalid_request with `field`; 429 rate_limited.
 * State-changing requests must send Content-Type: application/json and come from WEB_URL.
 * The emailed link is WEB_URL/auth/verify#token=<token>: valid 15 minutes, single use, and
 * superseded by a newer link for the same email.
 */

export const organiserNameSchema = z.string().trim().min(1).max(120);

export const magicLinkRequest = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  /**
   * Sign-up form only. Names the first organisation if the email is new (otherwise the part
   * before the @ is used); ignored for existing accounts.
   */
  organiserName: organiserNameSchema.optional(),
});
export type MagicLinkRequest = z.infer<typeof magicLinkRequest>;

export const magicLinkVerify = z.object({
  token: z.string().min(1).max(200),
});
export type MagicLinkVerify = z.infer<typeof magicLinkVerify>;

export interface SessionUser {
  id: string;
  email: string;
  /** From Google, or null for email sign-ups until they add one. */
  name: string | null;
  mfaEnabled: boolean;
}

export interface Session {
  user: SessionUser;
  /** The organisation to show; null only if the user has lost every membership. */
  organisation: OrganisationDto | null;
  organisations: OrganisationDto[];
}

/**
 * MFA with an authenticator app (S0-3/S0-4). Owners and finance need a check in the last
 * 15 minutes before payouts, granting owner or finance, and bulk export (403 mfa_required).
 *
 * POST /me/mfa/totp/setup     -> 200 TotpSetup; 409 mfa_already_enabled
 * POST /me/mfa/totp/confirm   MfaCode -> 200 { recoveryCodes } (shown once); 422 invalid_code
 * POST /auth/mfa/verify       MfaCode -> 204, session counts as MFA-verified for 15 minutes;
 *                             422 invalid_code; 409 mfa_not_enabled
 */
export const mfaCode = z.union([
  z.object({ code: z.string().regex(/^\d{6}$/) }),
  z.object({ recoveryCode: z.string().trim().min(8).max(32) }),
]);
export type MfaCode = z.infer<typeof mfaCode>;

export interface TotpSetup {
  /** Base32 secret for manual entry. */
  secret: string;
  /** otpauth:// URL to show as a QR code. */
  otpauthUrl: string;
}

export interface RecoveryCodes {
  recoveryCodes: string[];
}
