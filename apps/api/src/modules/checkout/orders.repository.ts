import { Injectable } from '@nestjs/common';
import type pg from 'pg';

export interface OrderRow {
  id: string;
  organisation_id: string;
  event_id: string;
  buyer_email: string;
}

export interface NewOrder {
  id: string;
  organisationId: string;
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  marketingOptIn: boolean;
}

@Injectable()
export class OrdersRepository {
  /**
   * Claims an idempotency key for a new order id. Returns false when the key is already taken; a
   * concurrent claim of the same key waits here until the first one commits or rolls back.
   */
  async claimRequest(
    tx: pg.PoolClient,
    idempotencyKey: string,
    orderId: string,
    holdsDigest: Buffer,
  ): Promise<boolean> {
    const { rowCount } = await tx.query(
      `insert into checkout.order_requests (idempotency_key, order_id, holds_digest)
       values ($1, $2, $3)
       on conflict (idempotency_key) do nothing`,
      [idempotencyKey, orderId, holdsDigest],
    );
    return rowCount === 1;
  }

  async findRequest(
    tx: pg.PoolClient,
    idempotencyKey: string,
  ): Promise<{ order_id: string; holds_digest: Buffer } | null> {
    const { rows } = await tx.query<{ order_id: string; holds_digest: Buffer }>(
      'select order_id, holds_digest from checkout.order_requests where idempotency_key = $1',
      [idempotencyKey],
    );
    return rows[0] ?? null;
  }

  /** Inserts the order, which must be the order in scope (row-level security checks). */
  async insert(tx: pg.PoolClient, order: NewOrder): Promise<void> {
    await tx.query(
      `insert into checkout.orders
         (id, organisation_id, event_id, buyer_name, buyer_email, marketing_opt_in)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        order.id,
        order.organisationId,
        order.eventId,
        order.buyerName,
        order.buyerEmail,
        order.marketingOptIn,
      ],
    );
  }

  async find(tx: pg.PoolClient, orderId: string): Promise<OrderRow | null> {
    const { rows } = await tx.query<OrderRow>(
      'select id, organisation_id, event_id, buyer_email from checkout.orders where id = $1',
      [orderId],
    );
    return rows[0] ?? null;
  }

  async insertKey(
    tx: pg.PoolClient,
    orderId: string,
    keyHash: Buffer,
    expiresAt: Date,
  ): Promise<void> {
    await tx.query(
      'insert into checkout.order_keys (key_hash, order_id, expires_at) values ($1, $2, $3)',
      [keyHash, orderId, expiresAt],
    );
  }

  /** The order a key opens, if the key exists and has not expired. */
  async orderForKey(tx: pg.PoolClient, keyHash: Buffer, now: Date): Promise<string | null> {
    const { rows } = await tx.query<{ order_id: string }>(
      'select order_id from checkout.order_keys where key_hash = $1 and expires_at > $2',
      [keyHash, now],
    );
    return rows[0]?.order_id ?? null;
  }
}
