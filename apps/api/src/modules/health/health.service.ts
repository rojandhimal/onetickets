import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../../database/database.module.js';

export interface HealthReport {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
}

@Injectable()
export class HealthService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async check(): Promise<HealthReport> {
    try {
      await this.pool.query('select 1');
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
