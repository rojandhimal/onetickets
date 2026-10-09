import { Module } from '@nestjs/common';
import { ConsoleMailer, Mailer, OutboxMailer, SesMailer, SmtpMailer } from './mailer.js';

function mailerClass() {
  switch (process.env.MAIL_TRANSPORT) {
    case 'outbox':
      return OutboxMailer;
    case 'console':
      return ConsoleMailer;
    case 'ses':
      return SesMailer;
    case 'smtp':
      return SmtpMailer;
    default:
      throw new Error(`MAIL_TRANSPORT must be 'ses', 'smtp', 'console' or 'outbox'`);
  }
}

@Module({
  providers: [{ provide: Mailer, useFactory: (): Mailer => new (mailerClass())() }],
  exports: [Mailer],
})
export class NotificationsModule {}
