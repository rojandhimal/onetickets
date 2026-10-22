import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { CatalogueModule } from '../catalogue/index.js';
import { InventoryModule } from '../inventory/index.js';
import { TicketingModule } from '../ticketing/index.js';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

/** Checkout module: free orders from holds, and the buyer's access to their tickets (S2-2). */
@Module({
  imports: [DatabaseModule, CatalogueModule, InventoryModule, TicketingModule],
  controllers: [OrdersController],
  providers: [OrdersRepository, OrdersService],
  exports: [OrdersService],
})
export class CheckoutModule {}
