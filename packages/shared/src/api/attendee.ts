import { z } from 'zod';
import { magicLinkRequest } from './auth.js';
import type { OrderTicketsDto } from './orders.js';

/** SEC-4: separate from organiser sign-in. POST exchanges only; no credentials in queries. */
export const attendeeLinkRequest = magicLinkRequest.pick({ email: true, turnstileToken: true });
export const attendeeLinkVerify = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export const attendeeOrdersQuery = z.object({ after: z.uuid().optional() });
export type AttendeeLinkRequest = z.infer<typeof attendeeLinkRequest>;
export type AttendeeLinkVerify = z.infer<typeof attendeeLinkVerify>;
export type AttendeeOrdersQuery = z.infer<typeof attendeeOrdersQuery>;

/** An email-scoped session, never an organiser identity. Absolute expiry; idle timeout is 7 days. */
export interface AttendeeSession {
  email: string;
  expiresAt: string;
  permissions: ['tickets:read'];
}

/** Up to 100 orders in stable UUID order. Follow nextCursor until null, then sort for display. */
export interface AttendeeOrdersDto {
  orders: OrderTicketsDto[];
  nextCursor: string | null;
}
