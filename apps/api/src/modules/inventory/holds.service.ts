import { HttpStatus, Injectable } from '@nestjs/common';
import type { HoldDto, HoldPublicDto, HoldStatus, ReserveHoldBody } from '@onetickets/shared';
import type pg from 'pg';
import { UnitOfWork } from '../../database/database.module.js';
import { ApiError } from '../identity/index.js';
import { EventsService } from '../catalogue/index.js';
import { HOLD_DURATION_SECONDS, MAX_HOLD_DURATION_SECONDS } from './inventory.config.js';
import { HoldsRepository } from './holds.repository.js';
import { hashHoldToken, newHoldToken } from './secrets.js';

@Injectable()
export class HoldsService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly holds: HoldsRepository,
    private readonly catalogue: EventsService,
  ) {}

  /**
   * Reserves a hold for a ticket type (INV-1, INV-2, ARCH-2).
   * Validates per-order limits (INV-4), verifies on-sale status, and atomically reserves
   * capacity with a single conditional update.
   */
  async reserve(body: ReserveHoldBody, now = new Date()): Promise<HoldDto> {
    if (body.quantity < 1) {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'invalid_quantity',
        'Quantity must be at least 1.',
        'quantity',
      );
    }

    return this.uow.run({}, async (tx) => {
      // 1. Verify ticket type exists, event is published, and sales window is open.
      const summary = await this.catalogue.ticketTypeSummary(tx, body.ticketTypeId, now);
      if (!summary) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'ticket_type_not_found', 'Ticket type not found.');
      }
      if (summary.eventStatus !== 'published') {
        throw new ApiError(HttpStatus.NOT_FOUND, 'event_not_found', 'Event not found.');
      }
      if (!summary.onSale) {
        throw new ApiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'not_on_sale',
          'Sales are not open for this ticket type.',
        );
      }

      // 2. Enforce per-order limit (INV-4).
      if (body.quantity > summary.maxPerOrder) {
        throw new ApiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'invalid_quantity',
          `Can't be more than ${summary.maxPerOrder}, the limit per order.`,
          'quantity',
        );
      }

      // 3. If replacing a previous hold (e.g. quantity adjustment in stepper), release it first.
      if (body.previousHoldId && body.previousToken) {
        const prev = await this.holds.releaseHold(
          tx,
          body.previousHoldId,
          hashHoldToken(body.previousToken),
        );
        if (prev) {
          await this.holds.atomicReleaseInventory(tx, prev.ticket_type_id, prev.quantity);
        }
      }

      // 4. Atomic conditional reservation on inventory (INV-1, INV-2).
      const updated = await this.holds.atomicReserveInventory(tx, body.ticketTypeId, body.quantity);

      // 5. If conditional update failed, distinguish sold_out from all_taken (ARCH-2 / INV-15).
      if (!updated) {
        const current = await this.holds.getInventory(tx, body.ticketTypeId);
        if (!current || current.sold >= current.capacity) {
          throw new ApiError(
            HttpStatus.CONFLICT,
            'sold_out',
            'Those tickets have just gone. Nothing was booked.',
          );
        }
        const spotsLeft = Math.max(0, current.capacity - current.sold - current.held);
        if (spotsLeft === 0) {
          throw new ApiError(
            HttpStatus.CONFLICT,
            'all_taken',
            'All taken right now. Check back in a few minutes.',
          );
        }
        throw new ApiError(
          HttpStatus.CONFLICT,
          'insufficient_spots',
          `Only ${spotsLeft} ticket${spotsLeft === 1 ? ' was' : 's were'} left.`,
          'quantity',
          { spotsLeft },
        );
      }

      // 6. Generate unguessable random token and record hold.
      const token = newHoldToken();
      const tokenHash = hashHoldToken(token);
      const expiresAt = new Date(now.getTime() + HOLD_DURATION_SECONDS * 1000);

      const hold = await this.holds.insertHold(tx, {
        ticketTypeId: body.ticketTypeId,
        organisationId: summary.organisationId,
        eventId: summary.eventId,
        quantity: body.quantity,
        tokenHash,
        expiresAt,
      });

      return {
        id: hold.id,
        ticketTypeId: hold.ticket_type_id,
        eventId: hold.event_id,
        quantity: hold.quantity,
        token,
        expiresAt: hold.expires_at.toISOString(),
        createdAt: hold.created_at.toISOString(),
      };
    });
  }

  /**
   * Renews an active hold while the user is active on the checkout page (up to 20m total).
   */
  async renew(
    holdId: string,
    token: string,
    now = new Date(),
  ): Promise<{ id: string; expiresAt: string }> {
    return this.uow.run({}, async (tx) => {
      const tokenHash = hashHoldToken(token);
      const hold = await this.holds.findActiveHold(tx, holdId, tokenHash);
      if (!hold) {
        const anyHold = await this.holds.findHoldById(tx, holdId);
        if (!anyHold) {
          throw new ApiError(HttpStatus.NOT_FOUND, 'hold_not_found', 'Hold not found.');
        }
        throw new ApiError(HttpStatus.GONE, 'hold_expired', 'That hold has expired.');
      }

      if (hold.expires_at.getTime() <= now.getTime()) {
        throw new ApiError(HttpStatus.GONE, 'hold_expired', 'That hold has expired.');
      }

      const maxExpiry = new Date(hold.created_at.getTime() + MAX_HOLD_DURATION_SECONDS * 1000);
      if (maxExpiry.getTime() <= now.getTime()) {
        throw new ApiError(
          HttpStatus.CONFLICT,
          'max_hold_duration_reached',
          'Holds can be kept for up to 20 minutes.',
        );
      }

      const candidateExpiry = new Date(now.getTime() + HOLD_DURATION_SECONDS * 1000);
      const newExpiresAt = new Date(Math.min(candidateExpiry.getTime(), maxExpiry.getTime()));

      const renewed = await this.holds.renewHold(tx, holdId, tokenHash, newExpiresAt);
      if (!renewed) {
        throw new ApiError(HttpStatus.GONE, 'hold_expired', 'That hold has expired.');
      }

      return {
        id: renewed.id,
        expiresAt: renewed.expires_at.toISOString(),
      };
    });
  }

  /**
   * Releases an active hold when a buyer cancels or navigates away.
   */
  async release(holdId: string, token: string): Promise<void> {
    await this.uow.run({}, async (tx) => {
      const released = await this.holds.releaseHold(tx, holdId, hashHoldToken(token));
      if (released) {
        await this.holds.atomicReleaseInventory(tx, released.ticket_type_id, released.quantity);
      }
    });
  }

  /**
   * Returns hold status and metadata.
   */
  async get(holdId: string, token?: string, now = new Date()): Promise<HoldPublicDto> {
    return this.uow.run({}, async (tx) => {
      const hold = await this.holds.findHoldById(tx, holdId);
      if (!hold) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'hold_not_found', 'Hold not found.');
      }
      if (token) {
        const tokenHash = hashHoldToken(token);
        if (Buffer.compare(hold.token_hash, tokenHash) !== 0) {
          throw new ApiError(HttpStatus.NOT_FOUND, 'hold_not_found', 'Hold not found.');
        }
      }

      let status: HoldStatus = 'active';
      if (hold.converted_at) {
        status = 'converted';
      } else if (hold.released_at) {
        status = 'released';
      } else if (hold.expires_at.getTime() <= now.getTime()) {
        status = 'expired';
      }

      return {
        id: hold.id,
        ticketTypeId: hold.ticket_type_id,
        eventId: hold.event_id,
        quantity: hold.quantity,
        expiresAt: hold.expires_at.toISOString(),
        createdAt: hold.created_at.toISOString(),
        status,
      };
    });
  }

  /**
   * Converts a hold into issued tickets upon checkout completion (S2-2 / S4-4).
   * Runs in the caller's transaction.
   */
  async convert(
    tx: pg.PoolClient,
    holdId: string,
    token: string,
    now = new Date(),
  ): Promise<HoldDto> {
    const tokenHash = hashHoldToken(token);
    const converted = await this.holds.convertHold(tx, holdId, tokenHash);
    if (!converted) {
      throw new ApiError(
        HttpStatus.GONE,
        'hold_expired',
        'That hold has expired or is no longer valid.',
      );
    }

    await this.holds.atomicConvertInventory(tx, converted.ticket_type_id, converted.quantity);

    return {
      id: holdId,
      ticketTypeId: converted.ticket_type_id,
      eventId: converted.event_id,
      quantity: converted.quantity,
      token,
      expiresAt: now.toISOString(),
      createdAt: now.toISOString(),
    };
  }

  /**
   * Sweeps expired holds in one transaction per hold (INV-3).
   * Multiple sweepers running concurrently return stock exactly once without double-decrementing.
   */
  async sweepExpired(limit = 100): Promise<number> {
    const expired = await this.uow.run({}, (tx) => this.holds.findExpiredHolds(tx, limit));
    let swept = 0;

    for (const item of expired) {
      // One transaction per hold (INV-3).
      await this.uow.run({}, async (tx) => {
        const claimed = await this.holds.atomicSweepHold(tx, item.id);
        if (claimed) {
          await this.holds.atomicReleaseInventory(tx, claimed.ticket_type_id, claimed.quantity);
          swept++;
        }
      });
    }

    return swept;
  }
}
