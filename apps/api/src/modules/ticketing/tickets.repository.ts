import { Injectable } from '@nestjs/common';
import type pg from 'pg';

export interface TicketRow {
  id: string;
  ref: string;
  organisation_id: string;
  event_id: string;
  ticket_type_id: string;
  ticket_type_name: string;
  order_id: string;
  issued_at: Date;
  key_id: string | null;
  signature: Buffer | null;
  revoked_at: Date | null;
}

/** A ticket with the name its order was booked under, as the buyer sees it. */
export interface TicketViewRow extends TicketRow {
  holder_name: string;
}

export interface NewTicket {
  ref: string;
  organisationId: string;
  eventId: string;
  ticketTypeId: string;
  orderId: string;
}

const TICKET_COLUMNS = `t.id, t.ref, t.organisation_id, t.event_id, t.ticket_type_id,
  tt.name as ticket_type_name, t.order_id, t.issued_at, t.key_id, t.signature, t.revoked_at`;

@Injectable()
export class TicketsRepository {
  /**
   * Inserts tickets, skipping any whose ref is already taken in the event (the caller retries
   * those with new refs). Returns the refs that went in.
   */
  async insert(tx: pg.PoolClient, tickets: NewTicket[]): Promise<string[]> {
    if (tickets.length === 0) return [];
    const { rows } = await tx.query<{ ref: string }>(
      `insert into ticketing.tickets (ref, organisation_id, event_id, ticket_type_id, order_id)
       select * from unnest($1::text[], $2::uuid[], $3::uuid[], $4::uuid[], $5::uuid[])
       on conflict (event_id, ref) do nothing
       returning ref`,
      [
        tickets.map((t) => t.ref),
        tickets.map((t) => t.organisationId),
        tickets.map((t) => t.eventId),
        tickets.map((t) => t.ticketTypeId),
        tickets.map((t) => t.orderId),
      ],
    );
    return rows.map((r) => r.ref);
  }

  /** An order's tickets in issue order (row-level security limits this to the order in scope). */
  async forOrder(tx: pg.PoolClient, orderId: string): Promise<TicketViewRow[]> {
    const { rows } = await tx.query<TicketViewRow>(
      `select ${TICKET_COLUMNS}, o.buyer_name as holder_name
       from ticketing.tickets t
       join catalogue.ticket_types tt on tt.id = t.ticket_type_id
       join checkout.orders o on o.id = t.order_id
       where t.order_id = $1
       order by tt.position, t.issued_at, t.ref`,
      [orderId],
    );
    return rows;
  }

  /** Locks the order's unsigned tickets so two signers never sign the same one. */
  async lockUnsigned(tx: pg.PoolClient, orderId: string): Promise<TicketRow[]> {
    const { rows } = await tx.query<TicketRow>(
      `select ${TICKET_COLUMNS}
       from ticketing.tickets t
       join catalogue.ticket_types tt on tt.id = t.ticket_type_id
       where t.order_id = $1 and t.signature is null
       order by t.ref
       for update of t skip locked`,
      [orderId],
    );
    return rows;
  }

  async saveSignature(
    tx: pg.PoolClient,
    ticketId: string,
    keyId: string,
    signature: Uint8Array,
  ): Promise<void> {
    await tx.query(
      `update ticketing.tickets
       set key_id = $2, signature = $3, signed_at = now()
       where id = $1 and signature is null`,
      [ticketId, keyId, Buffer.from(signature)],
    );
  }
}
