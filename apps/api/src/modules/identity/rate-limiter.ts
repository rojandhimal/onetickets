import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../database/database.module.js';
import { ApiError } from './errors.js';

export interface Limit {
  key: string;
  max: number;
  windowMs: number;
  /**
   * Count over a rolling window (the previous window, weighted by how much of it still
   * overlaps, plus this one) instead of a fixed one, so a burst cannot get 2x by straddling
   * a window boundary.
   */
  rolling?: boolean;
  /** Logged once, on the first request over the limit in a window. */
  warning?: string;
}

/**
 * Fixed-window counters in Postgres. Each hit commits on its own, so a request that later
 * fails still counts. Cloudflare adds a coarser per-IP rule in front.
 */
@Injectable()
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);

  constructor(private readonly uow: UnitOfWork) {}

  async hit(...limits: Limit[]): Promise<void> {
    const now = Date.now();
    const over = await this.uow.run({}, async (tx) => {
      const results: boolean[] = [];
      for (const limit of limits) {
        const windowStart = Math.floor(now / limit.windowMs) * limit.windowMs;
        const { rows } = await tx.query<{ count: number; previous: number }>(
          `with hit as (
             insert into identity.rate_limits (key, window_start, count) values ($1, $2, 1)
             on conflict (key, window_start) do update set count = identity.rate_limits.count + 1
             returning count
           )
           select hit.count,
                  coalesce((select count from identity.rate_limits
                             where key = $1 and window_start = $3), 0) as previous
             from hit`,
          [limit.key, new Date(windowStart), new Date(windowStart - limit.windowMs)],
        );
        const { count, previous } = rows[0]!;
        const overlap = limit.rolling ? 1 - (now - windowStart) / limit.windowMs : 0;
        const carried = Math.floor(previous * overlap);
        const total = carried + count;
        if (total > limit.max && total - 1 <= limit.max && limit.warning) {
          this.logger.warn(limit.warning);
        }
        results.push(total > limit.max);
      }
      return results;
    });
    if (over.some(Boolean)) {
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'rate_limited',
        'Too many attempts. Wait a few minutes and try again.',
      );
    }
  }
}
