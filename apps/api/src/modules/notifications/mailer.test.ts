import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue({}) }));
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class {
    send = send;
  },
  SendEmailCommand: class {
    constructor(readonly input: unknown) {}
  },
}));
import { ConsoleMailer, SesMailer } from './mailer.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  send.mockClear();
});
describe('transactional email transports', () => {
  it('passes Reply-To to SES while retaining the configured sender', async () => {
    vi.stubEnv('EMAIL_FROM_DOMAIN', 'example.test');
    const mailer = new SesMailer();
    await mailer.send({
      to: 'buyer@example.test',
      replyTo: 'host@example.test',
      subject: 'Tickets',
      text: 'Your tickets',
    });
    expect(send.mock.calls[0]![0].input).toMatchObject({
      FromEmailAddress: 'OneTickets <no-reply@example.test>',
      Destination: { ToAddresses: ['buyer@example.test'] },
      ReplyToAddresses: ['host@example.test'],
      Content: {
        Simple: { Subject: { Data: 'Tickets' }, Body: { Text: { Data: 'Your tickets' } } },
      },
    });
  });
  it('never prints a confidential ticket key or buyer details in console mode', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const key = randomBytes(32).toString('base64url');
    await new ConsoleMailer().send({
      to: 'buyer@example.test',
      subject: 'Private event',
      text: key,
      confidential: true,
    });
    expect(write).toHaveBeenCalledOnce();
    const output = String(write.mock.calls[0]![0]);
    expect(output).toContain('Confidential mail omitted');
    expect(output).not.toContain(key);
    expect(output).not.toContain('buyer@example.test');
    expect(output).not.toContain('Private event');
  });
});
