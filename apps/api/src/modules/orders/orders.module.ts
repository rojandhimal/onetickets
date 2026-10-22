import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/index.js';
import { InventoryModule } from '../inventory/index.js';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [InventoryModule, CatalogueModule],
  controllers: [OrdersController],
  providers: [OrdersRepository, OrdersService],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
