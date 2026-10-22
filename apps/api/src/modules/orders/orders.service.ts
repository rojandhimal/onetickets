import { HttpStatus, Injectable } from '@nestjs/common';
import type { CreateFreeOrderBody, OrderDto, PublicOrderDto } from '@onetickets/shared';
import type pg from 'pg';
import { UnitOfWork } from '../../database/database.module.js';
import { ApiError } from '../identity/index.js';
import { EventsService } from '../catalogue/index.js';
import { HoldsService } from '../inventory/index.js';
import { type OrderRow, OrdersRepository } from './orders.repository.js';
import { newOrderRef, newTicketRef } from './secrets.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly orders: OrdersRepository,
    private readonly holds: HoldsService,
    private readonly catalogue: EventsService,
  ) {}

  /**
   * Places a free ticket order (INV-5, S2-2).
   * Atomically converts the held ticket stock and records the order and tickets.
   * If a submission with the same idempotencyKey already exists, returns the existing order.
   */
  async createFreeOrder(body: CreateFreeOrderBody, now = new Date()): Promise<OrderDto> {
    return this.uow.run({}, async (tx) => {
      // 1. INV-5 idempotency check: if this key already placed an order, return it immediately.
      const existing = await this.orders.findByIdempotencyKey(tx, body.idempotencyKey);
      if (existing) {
        return this.hydrateOrderDto(tx, existing);
      }

      // 2. Atomically convert the hold into sold inventory (INV-1, INV-2).
      // If convert fails due to conflict, check if a concurrent request with the same key won.
      let convertedHold;
      try {
        convertedHold = await this.holds.convert(tx, body.holdId, body.holdToken, now);
      } catch (err) {
        const concurrent = await this.orders.findByIdempotencyKey(tx, body.idempotencyKey);
        if (concurrent) {
          return this.hydrateOrderDto(tx, concurrent);
        }
        throw err;
      }

      // 3. Verify hold belongs to the specified event.
      if (convertedHold.eventId !== body.eventId) {
        throw new ApiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'invalid_hold',
          'Hold does not match the requested event.',
        );
      }

      // 4. Verify event and ticket type exist and are published.
      const summary = await this.catalogue.ticketTypeSummary(tx, convertedHold.ticketTypeId, now);
      if (!summary || summary.eventStatus !== 'published') {
        throw new ApiError(HttpStatus.NOT_FOUND, 'event_not_found', 'Event not found.');
      }

      // 5. Insert order with a unique human-friendly orderRef.
      const orderRef = newOrderRef();
      const order = await this.orders.insertOrder(tx, {
        orderRef,
        organisationId: summary.organisationId,
        eventId: body.eventId,
        holdId: body.holdId,
        idempotencyKey: body.idempotencyKey,
        attendeeName: body.attendeeName,
        attendeeEmail: body.attendeeEmail,
        optInOrganiser: body.optInOrganiser,
        totalPriceCents: 0,
      });

      // If concurrent insert occurred with same idempotency key (ON CONFLICT DO NOTHING):
      if (!order) {
        const concurrent = await this.orders.findByIdempotencyKey(tx, body.idempotencyKey);
        if (concurrent) {
          return this.hydrateOrderDto(tx, concurrent);
        }
        throw new ApiError(
          HttpStatus.CONFLICT,
          'idempotency_conflict',
          'An order with this idempotency key is already processing.',
        );
      }

      // 6. Insert attendee tickets (one row per held spot).
      for (let i = 0; i < convertedHold.quantity; i++) {
        const ticketRef = newTicketRef();
        await this.orders.insertTicket(tx, {
          orderId: order.id,
          ticketRef,
          ticketTypeId: summary.id,
          organisationId: summary.organisationId,
          eventId: body.eventId,
          attendeeName: body.attendeeName,
        });
      }

      return this.hydrateOrderDto(tx, order);
    });
  }

  /**
   * Retrieves public order summary by human-friendly order reference (e.g. for confirmation screen).
   */
  async getByOrderRef(orderRef: string): Promise<PublicOrderDto> {
    return this.uow.run({}, async (tx) => {
      const order = await this.orders.findByOrderRef(tx, orderRef);
      if (!order) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'order_not_found', 'Order not found.');
      }

      const tickets = await this.orders.findTicketsByOrderId(tx, order.id);
      let eventTitle = '';
      let ticketTypeName = 'Ticket';
      if (tickets.length > 0) {
        const summary = await this.catalogue.ticketTypeSummary(tx, tickets[0]!.ticket_type_id);
        if (summary) {
          eventTitle = summary.eventName;
          ticketTypeName = summary.name;
        }
      }

      return {
        orderRef: order.order_ref,
        eventId: order.event_id,
        eventTitle,
        attendeeName: order.attendee_name,
        attendeeEmail: order.attendee_email,
        ticketCount: tickets.length,
        totalPriceCents: order.total_price_cents,
        status: order.status,
        createdAt: order.created_at.toISOString(),
        tickets: tickets.map((t) => ({
          ticketRef: t.ticket_ref,
          ticketTypeName,
          attendeeName: t.attendee_name,
          status: t.status,
        })),
      };
    });
  }

  private async hydrateOrderDto(tx: pg.PoolClient, order: OrderRow): Promise<OrderDto> {
    const tickets = await this.orders.findTicketsByOrderId(tx, order.id);
    let eventTitle = '';
    let ticketTypeName = 'Ticket';
    if (tickets.length > 0) {
      const summary = await this.catalogue.ticketTypeSummary(tx, tickets[0]!.ticket_type_id);
      if (summary) {
        eventTitle = summary.eventName;
        ticketTypeName = summary.name;
      }
    }

    return {
      id: order.id,
      orderRef: order.order_ref,
      eventId: order.event_id,
      eventTitle,
      attendeeName: order.attendee_name,
      attendeeEmail: order.attendee_email,
      ticketCount: tickets.length,
      totalPriceCents: order.total_price_cents,
      optInOrganiser: order.opt_in_organiser,
      status: order.status,
      createdAt: order.created_at.toISOString(),
      tickets: tickets.map((t) => ({
        id: t.id,
        ticketRef: t.ticket_ref,
        ticketTypeId: t.ticket_type_id,
        ticketTypeName,
        attendeeName: t.attendee_name,
        status: t.status,
        createdAt: t.created_at.toISOString(),
      })),
    };
  }
}
