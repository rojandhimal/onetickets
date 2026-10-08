import type pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { HealthService } from './health.service.js';

function poolWith(query: () => Promise<unknown>): pg.Pool {
  return { query: vi.fn(query) } as unknown as pg.Pool;
}

describe('HealthService', () => {
  it('reports ok when the database answers', async () => {
    const service = new HealthService(poolWith(async () => ({ rows: [] })));
    await expect(service.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('reports degraded when the database query fails', async () => {
    const service = new HealthService(
      poolWith(async () => {
        throw new Error('connection refused');
      }),
    );
    await expect(service.check()).resolves.toEqual({ status: 'degraded', database: 'down' });
  });
});
