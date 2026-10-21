import { z } from 'zod';

/**
 * API contract for inventory and ticket holds (Sprint 2: S2-1, S2-2).
 * Shared by api and web. Public routes live under /public/holds and need no session.
 */

export const reserveHoldBody = z.object({
  ticketTypeId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
  previousHoldId: z.string().uuid().optional(),
  previousToken: z.string().min(1).optional(),
});
export type ReserveHoldBody = z.infer<typeof reserveHoldBody>;

export const holdTokenBody = z.object({
  token: z.string().min(1),
});
export type HoldTokenBody = z.infer<typeof holdTokenBody>;

export interface HoldDto {
  id: string;
  ticketTypeId: string;
  eventId: string;
  quantity: number;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export type HoldStatus = 'active' | 'expired' | 'released' | 'converted';

export interface HoldPublicDto {
  id: string;
  ticketTypeId: string;
  eventId: string;
  quantity: number;
  expiresAt: string;
  createdAt: string;
  status: HoldStatus;
}

/** Error response when inventory has insufficient spots left (code `insufficient_spots`). */
export interface InsufficientSpotsBody {
  statusCode: 409;
  code: 'insufficient_spots';
  message: string;
  field: 'quantity';
  spotsLeft: number;
}
