// One redaction layer for every sink that leaves the process: logs, Sentry and OpenTelemetry
// (threat model section 6). Ids such as organisation, request and order ids are not personal
// data on their own and pass through untouched.

export const REDACTED = '[redacted]';

// A key is sensitive when any dotted segment (so "http.request.header.cookie" is checked part by
// part) contains one of these, compared case-insensitively with - and _ stripped. Substring
// matching catches recoveryCodes, totpSecret, sessionToken, x-api-key and set-cookie.
const SENSITIVE_PARTS = [
  'token',
  'secret',
  'password',
  'passwd',
  'cookie',
  'authorization',
  'apikey',
  'recovery',
  'session',
  'email',
];

// Too short to match as substrings ("slotPosition" contains "otp"), so these must be a whole word
// of the key: mfaCode, otp and totp_uri match; footprint does not.
const SENSITIVE_WORDS = new Set(['otp', 'totp', 'mfa']);

// Short, ambiguous keys matched exactly, so statusCode, hostname and zipCode survive.
const SENSITIVE_EXACT = new Set([
  'code',
  'name',
  'firstname',
  'lastname',
  'fullname',
  'username',
  'organisername',
  'phone',
  'phonenumber',
  'mobile',
  'address',
  'ip',
  'ipaddress',
]);

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}

function words(segment: string): string[] {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

export function isSensitiveKey(key: string): boolean {
  return key.split('.').some((segment) => {
    const normalised = normaliseKey(segment);
    return (
      SENSITIVE_EXACT.has(normalised) ||
      SENSITIVE_PARTS.some((part) => normalised.includes(part)) ||
      words(segment).some((word) => SENSITIVE_WORDS.has(word))
    );
  });
}

const PATTERNS: Array<[RegExp, string]> = [
  // Bearer and basic credentials.
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`],
  // Tokens in query strings or fragments, e.g. #token=abc or ?code=xyz&state=...
  [/([?#&](?:token|code|state|access_token|id_token)=)[^&#\s"']+/gi, `$1${REDACTED}`],
  // Stripe secret, restricted and client secrets.
  [/\b(sk|rk)_(live|test)_[A-Za-z0-9]+/g, REDACTED],
  [/\bpi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+/g, REDACTED],
  // Email addresses.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED],
  // Australian phone numbers: +61 4xx xxx xxx, 04xx xxx xxx, (02) xxxx xxxx. Kept narrow so
  // ids, amounts and timestamps made of digits survive.
  [/(?:\+61[\s-]?|\b0)4\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g, REDACTED],
  [/(?:\+61[\s-]?\(?0?|\(0)[2378]\)?[\s-]?\d{4}[\s-]?\d{4}\b/g, REDACTED],
];

export function redactString(value: string): string {
  return PATTERNS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), value);
}

/** Drops the query string and fragment, which is where tokens and search terms live. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * Deep-copies a value, replacing sensitive keys and scrubbing personal data out of strings.
 * Safe on cycles and bounded in depth so it can run on arbitrary error payloads.
 */
export function redact<T>(value: T, depth = 8, seen = new WeakSet<object>()): T {
  if (typeof value === 'string') return redactString(value) as T;
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]' as T;
  if (depth <= 0) return '[truncated]' as T;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth - 1, seen)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(inner, depth - 1, seen);
  }
  return out as T;
}
