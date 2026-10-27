import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  confirmationPath,
  type CancellationPolicy,
  type OrderTicketsDto,
  type VenueInput,
} from '@onetickets/shared';
import { z } from 'zod';
import { UnitOfWork } from '../../database/unit-of-work.js';
import { EventsService } from '../catalogue/index.js';
import { ApiError, RateLimiter } from '../identity/index.js';
import { Mailer, type Email } from '../notifications/index.js';
import { OrdersRepository } from './orders.repository.js';

const HOUR = 60 * 60_000;
const unavailable = () =>
  new ApiError(
    HttpStatus.SERVICE_UNAVAILABLE,
    'confirmation_email_unavailable',
    'Your booking is saved. Try again to finish sending your tickets.',
  );

export function confirmationRateKey(kind: 'email' | 'ip', value: string): string {
  return `confirmation:${kind}:${createHash('sha256').update(value).digest('base64url')}`;
}

/** Called only after checkout has verified the hold-token digest and committed the order. */
@Injectable()
export class ConfirmationEmails {
  private readonly webUrl = new URL(process.env.WEB_URL!).origin;

  constructor(
    private readonly uow: UnitOfWork,
    private readonly orders: OrdersRepository,
    private readonly catalogue: EventsService,
    private readonly mailer: Mailer,
    private readonly limiter: RateLimiter,
  ) {}

  async send(view: OrderTicketsDto, ticketKey: string, ip: string): Promise<void> {
    const scope = { orderId: view.orderId };
    // Check before consuming the budget; completed retries do not send again. The locked
    // check below is still necessary because two requests may both see an unsent receipt.
    const sent = await this.uow.run(scope, async (tx) => {
      const { rows } = await tx.query(
        'select sent_at from checkout.order_confirmations where order_id = $1',
        [view.orderId],
      );
      return Boolean(rows[0]?.sent_at);
    });
    if (sent) return;

    // Independent commits: failed deliveries also consume budget. No nested pool acquisition
    // while holding the delivery lock, even with many concurrent checkout retries.
    await this.limiter.hit(
      { key: confirmationRateKey('email', view.email), max: 20, windowMs: HOUR, rolling: true },
      { key: confirmationRateKey('ip', ip), max: 60, windowMs: 15 * 60_000, rolling: true },
    );
    await this.limiter.hit({
      key: 'confirmation:global',
      max: 300,
      windowMs: HOUR,
      rolling: true,
      warning: 'Ticket confirmation hourly send cap reached',
    });

    await this.uow.run(scope, async (tx) => {
      await tx.query(
        `insert into checkout.order_confirmations (order_id) values ($1)
         on conflict (order_id) do nothing`,
        [view.orderId],
      );
      const { rows } = await tx.query<{ sent_at: Date | null }>(
        'select sent_at from checkout.order_confirmations where order_id = $1 for update',
        [view.orderId],
      );
      if (!rows[0]) throw unavailable();
      if (rows[0].sent_at) return;
      const order = await this.orders.find(tx, view.orderId);
      if (!order) throw unavailable();
      const details = await this.catalogue.ticketEmailDetails(tx, order.event_id);
      const replyTo = z.email().safeParse(details?.contact_email);
      // Legacy published events may have no contact address. Never invent a fallback.
      if (!details || !replyTo.success || !details.venue) throw unavailable();
      try {
        await this.mailer.send(
          confirmationEmail(
            view,
            ticketKey,
            this.webUrl,
            replyTo.data,
            details.cancellation_policy,
            details.venue,
          ),
        );
      } catch {
        // Transport errors can contain recipient addresses or the entire message. Never log
        // or propagate them. The receipt rolls back; the committed order and key survive.
        throw unavailable();
      }
      await tx.query(
        'update checkout.order_confirmations set sent_at = now() where order_id = $1',
        [view.orderId],
      );
    });
  }
}

const CANCELLATION: Record<CancellationPolicy, string> = {
  any_time: 'Cancel any time. Release your ticket up to the start.',
  up_to_24h: 'Cancel up to 24 hours before. Release your ticket up to 24 hours before the start.',
  none: "No cancellations. Tickets can't be released once booked.",
};
const line = (value: string) => value.replace(/\p{Cc}+/gu, ' ').trim();

export function confirmationEmail(
  order: OrderTicketsDto,
  ticketKey: string,
  webUrl: string,
  replyTo: string,
  policy: CancellationPolicy,
  venue: VenueInput,
): Email {
  const event = order.event;
  const date = new Intl.DateTimeFormat('en-AU', {
    timeZone: event.timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = new Intl.DateTimeFormat('en-AU', {
    timeZone: event.timeZone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const where =
    venue.kind === 'online'
      ? `Online: ${line(venue.url)}`
      : `${line(venue.name)}, ${line(venue.address)}`;
  const tickets = order.tickets.map(
    (ticket, i) =>
      `Ticket ${i + 1} of ${order.tickets.length} · ${line(ticket.ticketTypeName)} · Ref ${line(ticket.ref)}`,
  );
  return {
    to: order.email,
    replyTo,
    confidential: true,
    subject: `Your tickets for ${line(event.name)}, ${date.format(start)}`,
    text: [
      `Hi, you're going to ${line(event.name)}.`,
      `${date.format(start)} · ${time.format(start)} to ${date.format(end)} ${time.format(end)}`,
      where,
      '',
      ...tickets,
      '',
      `See your tickets: ${new URL(confirmationPath(order.orderId, ticketKey), webUrl).href}`,
      'Open your tickets to show the QR at the door, save them for offline use or add the event to your calendar.',
      '',
      `Cancellation policy: ${CANCELLATION[policy]}`,
      `Questions about the event? Reply to this email to reach ${line(event.organiser.name)}.`,
      '',
      `Sold by ${line(event.organiser.name)}. Sent by OneTickets.`,
    ].join('\n'),
  };
}
