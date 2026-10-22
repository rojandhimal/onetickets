import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  type CreatedOrderDto,
  createOrderBody,
  type CreateOrderBody,
  type OrderTicketsDto,
} from '@onetickets/shared';
import { Public, ZodBody } from '../identity/index.js';
import { OrdersService } from './orders.service.js';

/**
 * Free orders and the buyer's tickets. Every response keeps the api's default no-store: the QR
 * tokens and the ticket key are bearer credentials.
 */
@Controller('public/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Makes a free order from a checkout's holds (S2-2, INV-5). */
  @Post()
  @Public()
  async create(
    @Body(new ZodBody(createOrderBody)) body: CreateOrderBody,
  ): Promise<CreatedOrderDto> {
    return this.orders.create(body);
  }

  /** The order's tickets, opened by its ticket key as a bearer token, never a query string. */
  @Get(':orderId/tickets')
  @Public()
  async tickets(
    @Param('orderId', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) orderId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<OrderTicketsDto> {
    const key = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1] ?? '';
    return this.orders.ticketsFor(orderId, key);
  }
}
