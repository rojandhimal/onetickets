import { Module } from '@nestjs/common';
import { ConsoleMailer, Mailer, OutboxMailer } from './mailer.js';

function mailerClass() {
  switch (process.env.MAIL_TRANSPORT) {
    case 'outbox':
      return OutboxMailer;
    case 'console':
      return ConsoleMailer;
    default:
      throw new Error(`MAIL_TRANSPORT must be 'outbox' or 'console' (SES arrives with S0-2)`);
  }
}

@Module({
  providers: [{ provide: Mailer, useFactory: (): Mailer => new (mailerClass())() }],
  exports: [Mailer],
})
export class NotificationsModule {}
