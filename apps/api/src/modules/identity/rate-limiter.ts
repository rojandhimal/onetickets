import { HttpStatus, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../database/database.module.js';
import { ApiError } from './errors.js';

export interface Limit {
  key: string;
  max: number;
  windowMs: number;
}

/**
 * Fixed-window counters in Postgres. Each hit commits on its own, so a request that later
 * fails still counts. Cloudflare adds a coarser per-IP rule in front.
 */
@Injectable()
export class RateLimiter {
  constructor(private readonly uow: UnitOfWork) {}

  async hit(...limits: Limit[]): Promise<void> {
    const counts = await this.uow.run({}, async (tx) => {
      const results: boolean[] = [];
      for (const limit of limits) {
        const windowStart = new Date(Math.floor(Date.now() / limit.windowMs) * limit.windowMs);
        const { rows } = await tx.query<{ count: number }>(
          `insert into identity.rate_limits (key, window_start, count) values ($1, $2, 1)
           on conflict (key, window_start) do update set count = identity.rate_limits.count + 1
           returning count`,
          [limit.key, windowStart],
        );
        results.push(rows[0]!.count > limit.max);
      }
      return results;
    });
    if (counts.some(Boolean)) {
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'rate_limited',
        'Too many attempts. Wait a few minutes and try again.',
      );
    }
  }
}
