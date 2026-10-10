import { Controller, Get, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../identity/index.js';
import { HealthService, type HealthReport } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Process is up. For the load balancer, so a database blip does not drain every task. */
  @Get('live')
  @Public()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Throws an unhandled error so staging can confirm Sentry receives api errors with release and
   * environment (QA 5.1). A 404 unless SENTRY_TEST_ROUTE=on; turn it off again afterwards.
   */
  @Get('sentry-test')
  @Public()
  sentryTest(): never {
    if (process.env.SENTRY_TEST_ROUTE !== 'on') throw new NotFoundException();
    throw new Error('Sentry test error from the api');
  }

  /** Process is up and the database answers. */
  @Get()
  @Public()
  async get(): Promise<HealthReport> {
    const report = await this.health.check();
    if (report.status !== 'ok') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
