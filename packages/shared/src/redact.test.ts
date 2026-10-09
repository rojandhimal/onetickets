import { describe, expect, it } from 'vitest';
import { REDACTED, redact, redactString, stripQuery } from './redact.js';

// A known PII sample run through the redactor, as the threat model asks for each sink.
const sample = {
  requestId: 'req_01',
  organisationId: 'org_42',
  user: { id: 'usr_7', email: 'priya@printshed.com.au', name: 'Priya Natarajan' },
  headers: {
    Authorization: 'Bearer eyJhbGciOi.abc.def',
    'set-cookie': 'ot_session=s3cr3t',
    accept: '*/*',
  },
  message:
    'Magic link for priya@printshed.com.au failed: https://app.onetickets.au/auth/verify#token=abc123',
  stripe: 'used sk_live_51Habc and pi_3Mx_secret_9yz',
  phone: '0412 345 678',
  note: 'Call +61 412 345 678 about order ord_99',
};

describe('redact', () => {
  const out = redact(sample);

  it('keeps ids', () => {
    expect(out.requestId).toBe('req_01');
    expect(out.organisationId).toBe('org_42');
    expect(out.user.id).toBe('usr_7');
    expect(out.headers.accept).toBe('*/*');
  });

  it('removes personal data and secrets', () => {
    const text = JSON.stringify(out);
    for (const leak of [
      'priya@',
      'Priya',
      'eyJhbGciOi',
      's3cr3t',
      'abc123',
      'sk_live',
      '_secret_',
      '412 345 678',
    ]) {
      expect(text).not.toContain(leak);
    }
    expect(out.user.email).toBe(REDACTED);
    expect(out.headers.Authorization).toBe(REDACTED);
    expect(out.note).toContain('ord_99');
  });

  it('does not mutate the input and survives cycles', () => {
    expect(sample.user.email).toBe('priya@printshed.com.au');
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(redact(cyclic)).toEqual({ a: 1, self: '[circular]' });
  });
});

describe('redactString', () => {
  it('scrubs OAuth codes in URLs', () => {
    expect(redactString('/auth/google/callback?code=4/abc&state=xyz')).toBe(
      `/auth/google/callback?code=${REDACTED}&state=${REDACTED}`,
    );
  });
});

describe('phone numbers', () => {
  it('scrubs Australian mobiles and landlines but not long ids', () => {
    expect(redactString('m 0412345678, +61 412 345 678, l (02) 9876 5432')).toBe(
      `m ${REDACTED}, ${REDACTED}, l ${REDACTED}`,
    );
    expect(redactString('took 1791473689712 ms, total 250000 cents')).toBe(
      'took 1791473689712 ms, total 250000 cents',
    );
  });
});

describe('stripQuery', () => {
  it('drops query and fragment', () => {
    expect(stripQuery('https://x.au/auth/verify?a=1#token=abc')).toBe('https://x.au/auth/verify');
    expect(stripQuery('/organiser')).toBe('/organiser');
  });
});

describe('isSensitiveKey', () => {
  it('catches MFA, recovery, session and credential keys however they are written', () => {
    const out = redact({
      recoveryCodes: ['ABCD-EFGH'],
      totpSecret: 'JBSWY3DPEHPK3PXP',
      totp_uri: 'otpauth://totp/x',
      mfaCode: '123456',
      otp: '123456',
      sessionToken: 's3cr3t',
      session_id: 'sid_1',
      'http.request.header.cookie': 'sid=abc',
      'http.request.header.x-api-key': 'k_1',
      'X-Auth-Token': 't_1',
      new_password: 'hunter2',
      contactEmail: 'x',
    });
    for (const value of Object.values(out)) expect(value).toBe(REDACTED);
  });

  it('keeps keys that only look similar', () => {
    const out = redact({
      statusCode: 500,
      status_code: 500,
      hostname: 'app.onetickets.au',
      slotPosition: 3,
      footprint: 'small',
      'http.request.method': 'GET',
      organisationId: 'org_42',
    });
    expect(out).toEqual({
      statusCode: 500,
      status_code: 500,
      hostname: 'app.onetickets.au',
      slotPosition: 3,
      footprint: 'small',
      'http.request.method': 'GET',
      organisationId: 'org_42',
    });
  });
});
