import { Module } from '@nestjs/common';
import { ConsoleMailer, Mailer, OutboxMailer, SesMailer } from './mailer.js';

function mailerClass() {
  switch (process.env.MAIL_TRANSPORT) {
    case 'outbox':
      return OutboxMailer;
    case 'console':
      return ConsoleMailer;
    case 'ses':
      return SesMailer;
    default:
      throw new Error(`MAIL_TRANSPORT must be 'ses', 'console' or 'outbox'`);
  }
}

@Module({
  providers: [{ provide: Mailer, useFactory: (): Mailer => new (mailerClass())() }],
  exports: [Mailer],
})
export class NotificationsModule {}
