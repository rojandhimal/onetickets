import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  type HoldDto,
  type HoldPublicDto,
  holdTokenBody,
  type HoldTokenBody,
  reserveHoldBody,
  type ReserveHoldBody,
} from '@onetickets/shared';
import { Public, ZodBody } from '../identity/index.js';
import { HoldsService } from './holds.service.js';

@Controller('public/holds')
export class HoldsController {
  constructor(private readonly holds: HoldsService) {}

  /** Reserves a hold on a ticket type (INV-1, INV-2, INV-4, ARCH-2). */
  @Post()
  @Public()
  async reserve(@Body(new ZodBody(reserveHoldBody)) body: ReserveHoldBody): Promise<HoldDto> {
    return this.holds.reserve(body);
  }

  /** Gets hold details and current status. */
  @Get(':id')
  @Public()
  async get(
    @Param('id') id: string,
    @Query('token') queryToken?: string,
    @Headers('x-hold-token') headerToken?: string,
  ): Promise<HoldPublicDto> {
    const token = queryToken || headerToken;
    return this.holds.get(id, token);
  }

  /** Renews an active hold for another window (up to 20m total). */
  @Post(':id/renew')
  @Public()
  @HttpCode(HttpStatus.OK)
  async renew(
    @Param('id') id: string,
    @Body(new ZodBody(holdTokenBody)) body: HoldTokenBody,
  ): Promise<{ id: string; expiresAt: string }> {
    return this.holds.renew(id, body.token);
  }

  /** Releases an active hold when a buyer changes their mind or leaves checkout. */
  @Post(':id/release')
  @Public()
  @HttpCode(HttpStatus.OK)
  async release(
    @Param('id') id: string,
    @Body(new ZodBody(holdTokenBody)) body: HoldTokenBody,
  ): Promise<{ ok: true }> {
    await this.holds.release(id, body.token);
    return { ok: true };
  }
}
