import { HttpException, HttpStatus } from '@nestjs/common';

/** An HTTP error with a stable `code` the web app can switch on (see ApiErrorBody). */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    message: string,
    field?: string,
    /** Extra body fields for this code, e.g. `missing` on `not_ready`. */
    extra: Record<string, unknown> = {},
  ) {
    super({ ...extra, statusCode: status, code, message, ...(field ? { field } : {}) }, status);
  }
}

export const notSignedIn = () =>
  new ApiError(HttpStatus.UNAUTHORIZED, 'not_signed_in', 'Sign in to continue.');

// Not-a-member and unknown organisation look the same, so ids cannot be probed.
export const notAMember = () =>
  new ApiError(HttpStatus.NOT_FOUND, 'not_a_member', 'Organisation not found.');

export const forbidden = () =>
  new ApiError(HttpStatus.FORBIDDEN, 'forbidden', 'Your role does not allow this.');

export const mfaRequired = () =>
  new ApiError(
    HttpStatus.FORBIDDEN,
    'mfa_required',
    'Confirm it is you with your second factor to continue.',
  );

export const noAccessPolicy = () =>
  new ApiError(HttpStatus.FORBIDDEN, 'no_access_policy', 'This route is not open to anyone yet.');

export const invalidField = (field: string, message = 'Required.') =>
  new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'invalid_request', message, field);

// Turnstile (SEC-10). Neither sends a sign-in link; the web app asks the person to try again.
export const challengeFailed = () =>
  new ApiError(HttpStatus.FORBIDDEN, 'challenge_failed', 'Complete the check and try again.');

export const challengeUnavailable = () =>
  new ApiError(
    HttpStatus.SERVICE_UNAVAILABLE,
    'challenge_unavailable',
    "We couldn't check this request right now. Try again in a minute.",
  );
