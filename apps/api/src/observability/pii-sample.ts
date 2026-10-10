/** Known personal data and secrets that must never leave the process (threat model section 6). */
export const PII = {
  email: 'priya.sharma@example.com',
  name: 'Priya Sharma',
  phone: '0412 345 678',
  token: 'mlt_9f8e7d6c5b4a39281706f5e4d3c2b1a0', // gitleaks:allow (fake, for redaction tests)
  cookie: 'ot_session=s3cr3t-session-token-value',
  authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig',
  ip: '203.0.113.42',
};

/** Every PII value found in `text`, so a failing test names what leaked. */
export function leaks(text: string): string[] {
  return Object.values(PII).filter((value) => text.includes(value));
}
