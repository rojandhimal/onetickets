import { Controller, Get, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import {
  attendeeOrdersQuery,
  type AttendeeOrdersDto,
  type OrderTicketsDto,
} from '@onetickets/shared';
import { type AppRequest, AttendeeAuthService, Public, ZodBody } from '../identity/index.js';
import { OrdersService } from './orders.service.js';

/** @Public bypasses organiser auth only: every handler requires a separate attendee session. */
@Controller('attendee/orders')
export class AttendeeOrdersController {
  constructor(
    private readonly auth: AttendeeAuthService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  @Public()
  async list(
    @Req() request: AppRequest,
    @Query(new ZodBody(attendeeOrdersQuery)) query: { after?: string },
  ): Promise<AttendeeOrdersDto> {
    const session = await this.auth.requireSession(request);
    return this.orders.attendeeOrders(session.email, query.after);
  }

  @Get(':orderId/tickets')
  @Public()
  async tickets(
    @Req() request: AppRequest,
    @Param('orderId', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) orderId: string,
  ): Promise<OrderTicketsDto> {
    const session = await this.auth.requireSession(request);
    return this.orders.attendeeTickets(session.email, orderId);
  }
}
