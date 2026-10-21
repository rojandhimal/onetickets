import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { CatalogueModule } from '../catalogue/index.js';
import { HoldsController } from './holds.controller.js';
import { HoldsRepository } from './holds.repository.js';
import { HoldsService } from './holds.service.js';

/** Inventory module: capacity tracking, atomic hold reservations, and sweeper. */
@Module({
  imports: [DatabaseModule, CatalogueModule],
  controllers: [HoldsController],
  providers: [HoldsRepository, HoldsService],
  exports: [HoldsService],
})
export class InventoryModule {}
