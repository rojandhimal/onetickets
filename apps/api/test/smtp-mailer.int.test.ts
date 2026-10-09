import { createServer, type Server } from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SmtpMailer } from '../src/modules/notifications/mailer.js';

/** Just enough SMTP to accept one message, like Mailpit with no auth and no TLS. */
function fakeSmtp(received: string[]): Server {
  return createServer((socket) => {
    let inData = false;
    let message = '';
    socket.write('220 fake ESMTP\r\n');
    socket.on('data', (chunk) => {
      for (const line of chunk.toString().split('\r\n')) {
        if (inData) {
          if (line === '.') {
            inData = false;
            received.push(message);
            message = '';
            socket.write('250 queued\r\n');
          } else {
            message += `${line}\n`;
          }
        } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250 fake\r\n');
        else if (/^DATA/i.test(line)) {
          inData = true;
          socket.write('354 go ahead\r\n');
        } else if (/^QUIT/i.test(line)) socket.end('221 bye\r\n');
        else if (line) socket.write('250 ok\r\n');
      }
    });
  });
}

describe('SmtpMailer', () => {
  const received: string[] = [];
  const server = fakeSmtp(received);

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String((server.address() as AddressInfo).port);
  });

  afterAll(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    server.close();
  });

  it('delivers mail over plain SMTP', async () => {
    await new SmtpMailer().send({ to: 'ana@example.com', subject: 'Sign in', text: 'Your link' });

    expect(received).toHaveLength(1);
    expect(received[0]).toContain('To: ana@example.com');
    expect(received[0]).toContain('Subject: Sign in');
    expect(received[0]).toContain('Your link');
  });

  it('refuses to start in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => new SmtpMailer()).toThrow('not allowed in production');
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
