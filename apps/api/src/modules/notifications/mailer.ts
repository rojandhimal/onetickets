import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { Injectable, Logger } from '@nestjs/common';

export interface Email {
  to: string;
  subject: string;
  text: string;
}

/** Sends transactional email: SES in AWS, the outbox in tests, the console locally. */
export abstract class Mailer {
  abstract send(email: Email): Promise<void>;
}

/** Keeps sent mail in memory so tests can read it. Never used outside tests. */
@Injectable()
export class OutboxMailer extends Mailer {
  readonly sent: Email[] = [];

  async send(email: Email): Promise<void> {
    this.sent.push(email);
  }

  lastTo(address: string): Email | undefined {
    return this.sent.findLast((email) => email.to === address);
  }
}

/**
 * Prints mail to the console for local development. It prints sign-in links, so it refuses
 * to start in production.
 */
@Injectable()
export class ConsoleMailer extends Mailer {
  private readonly logger = new Logger('Mail');

  constructor() {
    super();
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MAIL_TRANSPORT=console is not allowed in production');
    }
  }

  async send(email: Email): Promise<void> {
    this.logger.log(`To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}`);
  }
}

/** Amazon SES. The task role allows ses:SendEmail on EMAIL_FROM_DOMAIN. */
@Injectable()
export class SesMailer extends Mailer {
  private readonly client = new SESv2Client({});
  private readonly from: string;

  constructor() {
    super();
    const domain = process.env.EMAIL_FROM_DOMAIN;
    if (!domain) throw new Error('EMAIL_FROM_DOMAIN is not set');
    this.from = `OneTickets <no-reply@${domain}>`;
  }

  async send(email: Email): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [email.to] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: { Text: { Data: email.text, Charset: 'UTF-8' } },
          },
        },
      }),
    );
  }
}
