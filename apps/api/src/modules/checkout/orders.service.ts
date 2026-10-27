import { randomUUID, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  AttendeeOrdersDto,
  CreatedOrderDto,
  CreateOrderBody,
  OrderTicketsDto,
} from '@onetickets/shared';
import type pg from 'pg';
import { setScope, UnitOfWork } from '../../database/unit-of-work.js';
import { EventsService } from '../catalogue/index.js';
import { ApiError } from '../identity/index.js';
import { HoldsService } from '../inventory/index.js';
import { TicketsService } from '../ticketing/index.js';
import { ConfirmationEmails } from './confirmation-emails.js';
import { OrdersRepository } from './orders.repository.js';
import { hashTicketKey, holdsDigest, newTicketKey, TICKET_KEY_PATTERN } from './secrets.js';

/** How long a ticket key keeps working after the event ends. */
const KEY_DAYS_AFTER_EVENT = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const orderNotFound = () =>
  new ApiError(HttpStatus.NOT_FOUND, 'order_not_found', "That link doesn't work any more.");

@Injectable()
export class OrdersService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly orders: OrdersRepository,
    private readonly holds: HoldsService,
    private readonly catalogue: EventsService,
    private readonly tickets: TicketsService,
    private readonly confirmations: ConfirmationEmails,
  ) {}

  /**
   * Turns a checkout's holds into one free order and its tickets (S2-2, S2-3), in one
   * transaction. The same idempotency key with the same holds returns the same order (INV-5),
   * with a fresh ticket key, since only hashes of earlier keys are kept.
   */
  async create(body: CreateOrderBody, now = new Date(), ip = 'unknown'): Promise<CreatedOrderDto> {
    const digest = holdsDigest(body.holds);
    const ticketKey = newTicketKey();
    const orderId = await this.uow.run({}, async (tx) => {
      const newId = randomUUID();
      if (!(await this.orders.claimRequest(tx, body.idempotencyKey, newId, digest))) {
        const earlier = await this.orders.findRequest(tx, body.idempotencyKey);
        if (!earlier || !timingSafeEqual(earlier.holds_digest, digest)) {
          throw new ApiError(
            HttpStatus.CONFLICT,
            'idempotency_conflict',
            'That checkout was already used for other tickets. Start again.',
          );
        }
        await setScope(tx, { orderId: earlier.order_id });
        const order = await this.orders.find(tx, earlier.order_id);
        if (!order) throw orderNotFound();
        await this.addKey(tx, order.id, order.event_id, ticketKey);
        return order.id;
      }

      // Sorted, so two checkouts converting overlapping holds lock them in the same order.
      const converted = [];
      for (const hold of [...body.holds].sort((a, b) => a.id.localeCompare(b.id))) {
        converted.push(await this.holds.convert(tx, hold.id, hold.token, now));
      }
      const eventId = converted[0]!.eventId;
      if (converted.some((hold) => hold.eventId !== eventId)) {
        throw new ApiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'holds_mixed_events',
          'An order is for one event.',
          'holds',
        );
      }
      const summary = await this.catalogue.ticketTypeSummary(tx, converted[0]!.ticketTypeId, now);
      if (!summary || summary.eventStatus !== 'published') {
        throw new ApiError(HttpStatus.NOT_FOUND, 'event_not_found', 'Event not found.');
      }

      await setScope(tx, { orderId: newId });
      await this.orders.insert(tx, {
        id: newId,
        organisationId: summary.organisationId,
        eventId,
        buyerName: body.name,
        buyerEmail: body.email,
        marketingOptIn: body.marketingOptIn,
      });
      for (const hold of converted) {
        await this.tickets.issue(tx, {
          orderId: newId,
          organisationId: summary.organisationId,
          eventId,
          ticketTypeId: hold.ticketTypeId,
          quantity: hold.quantity,
        });
      }
      await this.addKey(tx, newId, eventId, ticketKey);
      return newId;
    });

    // Signed after the commit, so a signer that is slow or down never loses an order.
    await this.tickets.signOrder(orderId);
    const view = await this.uow.run({ orderId }, (tx) => this.view(tx, orderId));
    await this.confirmations.send(view, ticketKey, ip);
    return { ...view, ticketKey };
  }

  /** The order's tickets for whoever holds a key to it. A wrong id and a wrong key look alike. */
  async ticketsFor(orderId: string, ticketKey: string, now = new Date()): Promise<OrderTicketsDto> {
    if (!TICKET_KEY_PATTERN.test(ticketKey)) throw orderNotFound();
    return this.uow.run({}, async (tx) => {
      const opens = await this.orders.orderForKey(tx, hashTicketKey(ticketKey), now);
      if (opens !== orderId) throw orderNotFound();
      await setScope(tx, { orderId });
      return this.view(tx, orderId);
    });
  }

  /** Restricted attendee reads preserve SELECT-only RLS; they never set order/tenant scope. */
  async attendeeOrders(email: string, after?: string): Promise<AttendeeOrdersDto> {
    return this.uow.run({ attendeeEmail: email }, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `select id from checkout.orders where ($1::uuid is null or id > $1::uuid)
         order by id limit 101`,
        [after ?? null],
      );
      const page = rows.slice(0, 100);
      const orders: OrderTicketsDto[] = [];
      for (const row of page) orders.push(await this.view(tx, row.id));
      return { orders, nextCursor: rows.length > 100 ? page[99]!.id : null };
    });
  }

  async attendeeTickets(email: string, orderId: string): Promise<OrderTicketsDto> {
    return this.uow.run({ attendeeEmail: email }, (tx) => this.view(tx, orderId));
  }

  private async addKey(tx: pg.PoolClient, orderId: string, eventId: string, key: string) {
    const event = await this.catalogue.ticketEvent(tx, eventId);
    if (!event) throw orderNotFound();
    const expiresAt = new Date(Date.parse(event.endsAt) + KEY_DAYS_AFTER_EVENT * DAY_MS);
    await this.orders.insertKey(tx, orderId, hashTicketKey(key), expiresAt);
  }

  private async view(tx: pg.PoolClient, orderId: string): Promise<OrderTicketsDto> {
    const order = await this.orders.find(tx, orderId);
    if (!order) throw orderNotFound();
    const event = await this.catalogue.ticketEvent(tx, order.event_id);
    if (!event) throw orderNotFound();
    return {
      orderId,
      email: order.buyer_email,
      event,
      tickets: await this.tickets.forOrder(tx, orderId),
    };
  }
}
