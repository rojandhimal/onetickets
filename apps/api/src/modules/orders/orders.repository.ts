import { Injectable } from '@nestjs/common';
import type pg from 'pg';

export interface OrderRow {
  id: string;
  order_ref: string;
  organisation_id: string;
  event_id: string;
  hold_id: string;
  idempotency_key: string;
  attendee_name: string;
  attendee_email: string;
  opt_in_organiser: boolean;
  total_price_cents: number;
  status: 'confirmed' | 'cancelled';
  created_at: Date;
}

export interface TicketRow {
  id: string;
  order_id: string;
  ticket_ref: string;
  ticket_type_id: string;
  organisation_id: string;
  event_id: string;
  attendee_name: string;
  status: 'valid' | 'attended' | 'released';
  created_at: Date;
}

const ORDER_COLUMNS = `id, order_ref, organisation_id, event_id, hold_id, idempotency_key,
  attendee_name, attendee_email, opt_in_organiser, total_price_cents, status, created_at`;

const TICKET_COLUMNS = `id, order_id, ticket_ref, ticket_type_id, organisation_id, event_id,
  attendee_name, status, created_at`;

@Injectable()
export class OrdersRepository {
  /**
   * Finds an existing order by its idempotency key (INV-5).
   */
  async findByIdempotencyKey(tx: pg.PoolClient, idempotencyKey: string): Promise<OrderRow | null> {
    const { rows } = await tx.query<OrderRow>(
      `select ${ORDER_COLUMNS}
         from orders.orders
        where idempotency_key = $1`,
      [idempotencyKey],
    );
    return rows[0] ?? null;
  }

  /**
   * Finds an order by its unique public reference code (`order_ref`).
   */
  async findByOrderRef(tx: pg.PoolClient, orderRef: string): Promise<OrderRow | null> {
    const { rows } = await tx.query<OrderRow>(
      `select ${ORDER_COLUMNS}
         from orders.orders
        where order_ref = $1`,
      [orderRef],
    );
    return rows[0] ?? null;
  }

  /**
   * Inserts a new order. If an order with the same idempotency key was inserted concurrently,
   * returns null (via ON CONFLICT DO NOTHING) so the caller can return the winner's order.
   */
  async insertOrder(
    tx: pg.PoolClient,
    order: {
      orderRef: string;
      organisationId: string;
      eventId: string;
      holdId: string;
      idempotencyKey: string;
      attendeeName: string;
      attendeeEmail: string;
      optInOrganiser: boolean;
      totalPriceCents: number;
    },
  ): Promise<OrderRow | null> {
    const { rows } = await tx.query<OrderRow>(
      `insert into orders.orders
         (order_ref, organisation_id, event_id, hold_id, idempotency_key,
          attendee_name, attendee_email, opt_in_organiser, total_price_cents)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (idempotency_key) do nothing
       returning ${ORDER_COLUMNS}`,
      [
        order.orderRef,
        order.organisationId,
        order.eventId,
        order.holdId,
        order.idempotencyKey,
        order.attendeeName,
        order.attendeeEmail,
        order.optInOrganiser,
        order.totalPriceCents,
      ],
    );
    return rows[0] ?? null;
  }

  /**
   * Inserts an attendee ticket row.
   */
  async insertTicket(
    tx: pg.PoolClient,
    ticket: {
      orderId: string;
      ticketRef: string;
      ticketTypeId: string;
      organisationId: string;
      eventId: string;
      attendeeName: string;
    },
  ): Promise<TicketRow> {
    const { rows } = await tx.query<TicketRow>(
      `insert into orders.tickets
         (order_id, ticket_ref, ticket_type_id, organisation_id, event_id, attendee_name)
       values ($1, $2, $3, $4, $5, $6)
       returning ${TICKET_COLUMNS}`,
      [
        ticket.orderId,
        ticket.ticketRef,
        ticket.ticketTypeId,
        ticket.organisationId,
        ticket.eventId,
        ticket.attendeeName,
      ],
    );
    return rows[0]!;
  }

  /**
   * Finds all tickets belonging to an order.
   */
  async findTicketsByOrderId(tx: pg.PoolClient, orderId: string): Promise<TicketRow[]> {
    const { rows } = await tx.query<TicketRow>(
      `select ${TICKET_COLUMNS}
         from orders.tickets
        where order_id = $1
        order by id asc`,
      [orderId],
    );
    return rows;
  }
}
