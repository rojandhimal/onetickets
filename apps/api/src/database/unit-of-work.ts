import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from './tokens.js';

/** Who a transaction acts for. Row-level security reads these; unset means "nothing". */
export interface TenantScope {
  organisationId?: string;
  userId?: string;
}

/**
 * Runs work in one transaction with the tenant set via set_config(..., true), the equivalent of
 * SET LOCAL, so a pooled connection can never carry one request's organisation into the next.
 * Modules share a transaction by passing the client through service calls.
 */
@Injectable()
export class UnitOfWork {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async run<T>(scope: TenantScope, work: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        "select set_config('app.organisation_id', $1, true), set_config('app.user_id', $2, true)",
        [scope.organisationId ?? '', scope.userId ?? ''],
      );
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}
