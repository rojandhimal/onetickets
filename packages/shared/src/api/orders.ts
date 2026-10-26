import { z } from 'zod';
import type { PublicEventDto } from './events.js';
import type { TicketDto } from './tickets.js';

/**
 * API contract for free orders (S2-2) and the buyer's tickets (S2-3). Public routes live under
 * /public/orders and need no session: a buyer proves access to an order with its ticket key.
 */

/** One hold per ticket type, so an order never needs more than a handful. */
export const MAX_HOLDS_PER_ORDER = 20;

export const createOrderBody = z.object({
  /** One per checkout session. Every submit of that checkout sends the same key (INV-5). */
  idempotencyKey: z.string().uuid(),
  holds: z
    .array(z.object({ id: z.string().uuid(), token: z.string().min(1).max(100) }))
    .min(1)
    .max(MAX_HOLDS_PER_ORDER)
    .refine((holds) => new Set(holds.map((h) => h.id)).size === holds.length, {
      message: 'Each hold once.',
    }),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  marketingOptIn: z.boolean(),
});
export type CreateOrderBody = z.infer<typeof createOrderBody>;

/** The event as the ticket screen shows it. */
export type OrderEventDto = Pick<
  PublicEventDto,
  'slug' | 'name' | 'startsAt' | 'endsAt' | 'timeZone' | 'venue' | 'organiser'
>;

export interface OrderTicketsDto {
  orderId: string;
  /** Where the tickets were emailed. */
  email: string;
  event: OrderEventDto;
  /** In ticket type order, then issue order: "Ticket 1 of n". */
  tickets: TicketDto[];
}

export interface CreatedOrderDto extends OrderTicketsDto {
  /**
   * Opens this order's tickets (GET /public/orders/:orderId/tickets, as a bearer token). Shown
   * once; the api keeps only its hash. Never put it in a query string.
   */
  ticketKey: string;
}

/**
 * Where checkout sends the buyer once the order is made. The key rides in the fragment, which
 * browsers never send to a server or in a Referer.
 */
export function confirmationPath(orderId: string, ticketKey: string): string {
  return `/tickets/${encodeURIComponent(orderId)}#key=${encodeURIComponent(ticketKey)}`;
}
