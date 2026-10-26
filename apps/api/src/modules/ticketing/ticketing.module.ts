import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { ticketSignerFromEnv } from './signer.js';
import { TicketsRepository } from './tickets.repository.js';
import { TICKET_SIGNER, TicketsService } from './tickets.service.js';

/** Ticketing module: issues, signs and reads QR tickets (S2-3, ADR 0011). */
@Module({
  imports: [DatabaseModule],
  providers: [
    TicketsRepository,
    TicketsService,
    { provide: TICKET_SIGNER, useFactory: () => ticketSignerFromEnv() },
  ],
  exports: [TicketsService],
})
export class TicketingModule {}
