import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { encodeTicketPayload, encodeTicketToken, type TicketDto } from '@onetickets/shared';
import type pg from 'pg';
import { UnitOfWork } from '../../database/unit-of-work.js';
import type { TicketSigner } from './signer.js';
import {
  type NewTicket,
  TicketsRepository,
  type TicketRow,
  type TicketViewRow,
} from './tickets.repository.js';

export const TICKET_SIGNER = Symbol('TICKET_SIGNER');

/** Crockford base32 without I, L, O and U, so a ref read aloud or typed can't be misread. */
const REF_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REF_LENGTH = 8;

export interface IssueTickets {
  orderId: string;
  organisationId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly tickets: TicketsRepository,
    @Inject(TICKET_SIGNER) private readonly signer: TicketSigner | null,
  ) {}

  /**
   * Issues unsigned tickets inside the caller's order transaction, which must already have the
   * order in scope (`orderId` in the unit of work). Call signOrder() after the commit.
   */
  async issue(tx: pg.PoolClient, order: IssueTickets): Promise<void> {
    if (!Number.isInteger(order.quantity) || order.quantity < 1) {
      throw new Error('Issue at least one ticket.');
    }
    let wanted = order.quantity;
    // A clash on the 8-character ref within one event is rare (32^8 refs); retry just those.
    for (let attempt = 0; wanted > 0; attempt++) {
      if (attempt === 5) throw new Error('Could not find free ticket refs.');
      const batch: NewTicket[] = Array.from({ length: wanted }, () => ({
        ref: newTicketRef(),
        organisationId: order.organisationId,
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        orderId: order.orderId,
      }));
      wanted -= (await this.tickets.insert(tx, batch)).length;
    }
  }

  /**
   * Signs the order's unsigned tickets, if this process has a signer. Safe to call more than
   * once or from several processes: each ticket is signed exactly once.
   */
  async signOrder(orderId: string): Promise<number> {
    const signer = this.signer;
    if (!signer) return 0;
    return this.uow.run({ orderId }, async (tx) => {
      const unsigned = await this.tickets.lockUnsigned(tx, orderId);
      for (const ticket of unsigned) {
        const payload = encodeTicketPayload({
          keyId: signer.keyId,
          eventId: ticket.event_id,
          ticketId: ticket.id,
          issuedAt: ticket.issued_at,
        });
        await this.tickets.saveSignature(
          tx,
          ticket.id,
          signer.keyId,
          await signer.signTicket(payload),
        );
      }
      return unsigned.length;
    });
  }

  /**
   * The order's tickets for its buyer, in the caller's transaction. The caller has already checked
   * the order's key or restricted attendee session and set the corresponding RLS scope.
   */
  async forOrder(tx: pg.PoolClient, orderId: string): Promise<TicketDto[]> {
    return (await this.tickets.forOrder(tx, orderId)).map(toTicketDto);
  }
}

export function newTicketRef(): string {
  let ref = '';
  for (let i = 0; i < REF_LENGTH; i++) ref += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return ref;
}

/** The QR token for a signed ticket. Its bytes are rebuilt from the row exactly as signed. */
export function ticketToken(row: TicketRow): string | null {
  if (!row.signature || !row.key_id) return null;
  const payload = encodeTicketPayload({
    keyId: row.key_id,
    eventId: row.event_id,
    ticketId: row.id,
    issuedAt: row.issued_at,
  });
  return encodeTicketToken(payload, new Uint8Array(row.signature));
}

function toTicketDto(row: TicketViewRow): TicketDto {
  return {
    id: row.id,
    ref: row.ref,
    holderName: row.holder_name,
    ticketTypeId: row.ticket_type_id,
    ticketTypeName: row.ticket_type_name,
    // A revoked ticket must not be shown as something to scan.
    qr: row.revoked_at ? null : ticketToken(row),
    status: row.revoked_at ? 'revoked' : 'valid',
    issuedAt: row.issued_at.toISOString(),
  };
}
