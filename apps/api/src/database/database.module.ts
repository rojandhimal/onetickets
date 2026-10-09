import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import pg from 'pg';
import { PG_POOL } from './tokens.js';
import { UnitOfWork } from './unit-of-work.js';

export { PG_POOL } from './tokens.js';
export { setScope, UnitOfWork, type TenantScope } from './unit-of-work.js';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): pg.Pool => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
          throw new Error('DATABASE_URL is not set');
        }
        return new pg.Pool({ connectionString });
      },
    },
    UnitOfWork,
  ],
  exports: [PG_POOL, UnitOfWork],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
