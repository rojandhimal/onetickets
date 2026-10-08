import { Injectable, Logger } from '@nestjs/common';

export interface Email {
  to: string;
  subject: string;
  text: string;
}

/** Sends transactional email. Production uses SES (wired with S0-2); tests use the outbox. */
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
