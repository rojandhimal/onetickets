import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  createFreeOrderBody,
  type CreateFreeOrderBody,
  type OrderDto,
  type PublicOrderDto,
} from '@onetickets/shared';
import { Public, ZodBody } from '../identity/index.js';
import { OrdersService } from './orders.service.js';

@Controller('public/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Places a free ticket order (INV-5, S2-2).
   * Converts hold to sold tickets and creates order. Idempotent on idempotencyKey.
   */
  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async createFree(
    @Body(new ZodBody(createFreeOrderBody)) body: CreateFreeOrderBody,
  ): Promise<OrderDto> {
    return this.orders.createFreeOrder(body);
  }

  /**
   * Looks up a public order summary by human-friendly reference code (S2-2 / S2-3).
   */
  @Get(':orderRef')
  @Public()
  async getByOrderRef(@Param('orderRef') orderRef: string): Promise<PublicOrderDto> {
    return this.orders.getByOrderRef(orderRef);
  }
}
