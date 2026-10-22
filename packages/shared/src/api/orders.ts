import { z } from 'zod';

/**
 * API contracts for orders and checkout (Sprint 2: S2-2, S2-3, S2-4).
 * Shared by api and web. Public routes live under /public/orders and need no session.
 */

export const createFreeOrderBody = z.object({
  eventId: z.string().uuid(),
  holdId: z.string().uuid(),
  holdToken: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  attendeeName: z.string().trim().min(1, 'Enter the name for the ticket').max(100),
  attendeeEmail: z.string().trim().min(3).max(255).email('Enter your email address').toLowerCase(),
  optInOrganiser: z.boolean().default(false),
});
export type CreateFreeOrderBody = z.infer<typeof createFreeOrderBody>;

export interface OrderTicketDto {
  id: string;
  ticketRef: string;
  ticketTypeId: string;
  ticketTypeName: string;
  attendeeName: string;
  status: 'valid' | 'attended' | 'released';
  createdAt: string;
}

export interface OrderDto {
  id: string;
  orderRef: string;
  eventId: string;
  eventTitle: string;
  attendeeName: string;
  attendeeEmail: string;
  ticketCount: number;
  totalPriceCents: number;
  optInOrganiser: boolean;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  tickets: OrderTicketDto[];
}

export interface PublicOrderDto {
  orderRef: string;
  eventId: string;
  eventTitle: string;
  attendeeName: string;
  attendeeEmail: string;
  ticketCount: number;
  totalPriceCents: number;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  tickets: Array<{
    ticketRef: string;
    ticketTypeName: string;
    attendeeName: string;
    status: 'valid' | 'attended' | 'released';
  }>;
}
