import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { loggerOptions } from './logging.js';
import { leaks, PII } from './pii-sample.js';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  return { logger: pino(loggerOptions({}), stream), output: () => lines.join('') };
}

describe('api log redaction', () => {
  it('masks personal data and secrets in fields, nested objects, messages and errors', () => {
    const { logger, output } = capture();
    logger.info(
      {
        email: PII.email,
        user: { name: PII.name, phone: PII.phone },
        headers: { authorization: PII.authorization, cookie: PII.cookie },
        token: PII.token,
        ip: PII.ip,
        organisationId: 'org-123',
      },
      `Sign-in link sent to ${PII.email}`,
    );
    logger.error({ err: new Error(`No account for ${PII.email}`) }, 'lookup failed');
    logger.warn(`Callback /auth/google/callback?code=${PII.token}&state=abc`);

    const text = output();
    expect(leaks(text)).toEqual([]);
    expect(text).toContain('org-123');
    expect(text).toContain('lookup failed');
  });

  it("keeps an error's type and stack, with personal data masked, even with no message", () => {
    const { logger, output } = capture();
    // Nest's exception handler logs the error on its own like this.
    logger.error({
      context: 'ExceptionsHandler',
      err: new TypeError(`No account for ${PII.email}`),
    });
    logger.error(new Error(`Lookup for ${PII.email} failed`));

    const text = output();
    expect(leaks(text)).toEqual([]);
    const [first, second] = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(first.err).toMatchObject({
      type: 'TypeError',
      message: expect.stringContaining('No account for'),
    });
    expect(first.err.stack).toContain('logging.test');
    expect(first.msg).toContain('No account for');
    expect(second.err?.type ?? second.type).toBe('Error');
    expect(second.msg).toContain('Lookup for');
  });
});
