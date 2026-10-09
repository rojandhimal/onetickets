import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
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
