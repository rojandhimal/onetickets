import { Injectable } from '@nestjs/common';
import type pg from 'pg';

export interface HoldRow {
  id: string;
  ticket_type_id: string;
  organisation_id: string;
  event_id: string;
  quantity: number;
  token_hash: Buffer;
  created_at: Date;
  expires_at: Date;
  released_at: Date | null;
  converted_at: Date | null;
}

export interface InventoryCounts {
  capacity: number;
  sold: number;
  held: number;
}

const HOLD_COLUMNS = `id, ticket_type_id, organisation_id, event_id, quantity, token_hash,
  created_at, expires_at, released_at, converted_at`;

@Injectable()
export class HoldsRepository {
  /**
   * Reserving a hold uses a single conditional update (INV-1, INV-2, ADR 0007).
   * Returns null if sold + held + qty > capacity (meaning sold out or insufficient capacity).
   */
  async atomicReserveInventory(
    tx: pg.PoolClient,
    ticketTypeId: string,
    quantity: number,
  ): Promise<InventoryCounts | null> {
    const { rows } = await tx.query<InventoryCounts>(
      `update inventory.ticket_inventory
          set held = held + $1, updated_at = now()
        where ticket_type_id = $2
          and sold + held + $1 <= capacity
       returning capacity, sold, held`,
      [quantity, ticketTypeId],
    );
    return rows[0] ?? null;
  }

  /** Reads the current inventory row to distinguish sold_out from all_taken (ARCH-2). */
  async getInventory(tx: pg.PoolClient, ticketTypeId: string): Promise<InventoryCounts | null> {
    const { rows } = await tx.query<InventoryCounts>(
      `select capacity, sold, held
         from inventory.ticket_inventory
        where ticket_type_id = $1`,
      [ticketTypeId],
    );
    return rows[0] ?? null;
  }

  /** Inserts the hold record into inventory.holds. */
  async insertHold(
    tx: pg.PoolClient,
    hold: {
      ticketTypeId: string;
      organisationId: string;
      eventId: string;
      quantity: number;
      tokenHash: Buffer;
      expiresAt: Date;
    },
  ): Promise<HoldRow> {
    const { rows } = await tx.query<HoldRow>(
      `insert into inventory.holds
         (ticket_type_id, organisation_id, event_id, quantity, token_hash, expires_at)
       values ($1, $2, $3, $4, $5, $6)
       returning ${HOLD_COLUMNS}`,
      [
        hold.ticketTypeId,
        hold.organisationId,
        hold.eventId,
        hold.quantity,
        hold.tokenHash,
        hold.expiresAt,
      ],
    );
    return rows[0]!;
  }

  /** Finds an active hold by id and token hash. */
  async findActiveHold(
    tx: pg.PoolClient,
    holdId: string,
    tokenHash: Buffer,
  ): Promise<HoldRow | null> {
    const { rows } = await tx.query<HoldRow>(
      `select ${HOLD_COLUMNS}
         from inventory.holds
        where id = $1
          and token_hash = $2
          and released_at is null
          and converted_at is null`,
      [holdId, tokenHash],
    );
    return rows[0] ?? null;
  }

  /** Finds a hold by id (for status queries). */
  async findHoldById(tx: pg.PoolClient, holdId: string): Promise<HoldRow | null> {
    const { rows } = await tx.query<HoldRow>(
      `select ${HOLD_COLUMNS}
         from inventory.holds
        where id = $1`,
      [holdId],
    );
    return rows[0] ?? null;
  }

  /** Renews an active hold's expiration date. */
  async renewHold(
    tx: pg.PoolClient,
    holdId: string,
    tokenHash: Buffer,
    newExpiresAt: Date,
  ): Promise<{ id: string; expires_at: Date } | null> {
    const { rows } = await tx.query<{ id: string; expires_at: Date }>(
      `update inventory.holds
          set expires_at = $3
        where id = $1
          and token_hash = $2
          and released_at is null
          and converted_at is null
          and expires_at > now()
       returning id, expires_at`,
      [holdId, tokenHash, newExpiresAt],
    );
    return rows[0] ?? null;
  }

  /** Atomically marks a hold as released by token. */
  async releaseHold(
    tx: pg.PoolClient,
    holdId: string,
    tokenHash: Buffer,
  ): Promise<{ ticket_type_id: string; quantity: number } | null> {
    const { rows } = await tx.query<{ ticket_type_id: string; quantity: number }>(
      `update inventory.holds
          set released_at = now()
        where id = $1
          and token_hash = $2
          and released_at is null
          and converted_at is null
       returning ticket_type_id, quantity`,
      [holdId, tokenHash],
    );
    return rows[0] ?? null;
  }

  /** Decrements held count on inventory.ticket_inventory when a hold is released. */
  async atomicReleaseInventory(
    tx: pg.PoolClient,
    ticketTypeId: string,
    quantity: number,
  ): Promise<void> {
    await tx.query(
      `update inventory.ticket_inventory
          set held = greatest(0, held - $1), updated_at = now()
        where ticket_type_id = $2`,
      [quantity, ticketTypeId],
    );
  }

  /** Atomically marks a hold as converted to paid/issued tickets. */
  async convertHold(
    tx: pg.PoolClient,
    holdId: string,
    tokenHash: Buffer,
  ): Promise<{
    ticket_type_id: string;
    quantity: number;
    event_id: string;
    organisation_id: string;
  } | null> {
    const { rows } = await tx.query<{
      ticket_type_id: string;
      quantity: number;
      event_id: string;
      organisation_id: string;
    }>(
      `update inventory.holds
          set converted_at = now()
        where id = $1
          and token_hash = $2
          and released_at is null
          and converted_at is null
          and expires_at > now()
       returning ticket_type_id, quantity, event_id, organisation_id`,
      [holdId, tokenHash],
    );
    return rows[0] ?? null;
  }

  /** Transfers held stock to sold stock in ticket_inventory when a hold converts. */
  async atomicConvertInventory(
    tx: pg.PoolClient,
    ticketTypeId: string,
    quantity: number,
  ): Promise<void> {
    await tx.query(
      `update inventory.ticket_inventory
          set held = greatest(0, held - $1), sold = sold + $1, updated_at = now()
        where ticket_type_id = $2`,
      [quantity, ticketTypeId],
    );
  }

  /** Finds holds that have expired and have not yet been released or converted. */
  async findExpiredHolds(
    tx: pg.PoolClient,
    limit: number,
  ): Promise<Array<{ id: string; ticket_type_id: string; quantity: number }>> {
    const { rows } = await tx.query<{ id: string; ticket_type_id: string; quantity: number }>(
      `select id, ticket_type_id, quantity
         from inventory.holds
        where expires_at <= now()
          and released_at is null
          and converted_at is null
        limit $1`,
      [limit],
    );
    return rows;
  }

  /**
   * Sweeper atomically claims and marks one expired hold released (INV-3).
   * If another worker claimed it first, returns null.
   */
  async atomicSweepHold(
    tx: pg.PoolClient,
    holdId: string,
  ): Promise<{ ticket_type_id: string; quantity: number } | null> {
    const { rows } = await tx.query<{ ticket_type_id: string; quantity: number }>(
      `update inventory.holds
          set released_at = now()
        where id = $1
          and released_at is null
          and converted_at is null
       returning ticket_type_id, quantity`,
      [holdId],
    );
    return rows[0] ?? null;
  }
}
