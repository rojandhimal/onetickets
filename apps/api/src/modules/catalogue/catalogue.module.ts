import { Module } from '@nestjs/common';
import { BannerStorage, bannerStorageFromEnv } from './banner-storage.js';
import { CATALOGUE_CONFIG, loadCatalogueConfig } from './catalogue.config.js';
import { EventsController } from './events.controller.js';
import { EventsRepository } from './events.repository.js';
import { EventsService } from './events.service.js';
import { PublicEventsController } from './public-events.controller.js';

/** Events and ticket types: drafting, publishing, the public event page and browse. */
@Module({
  controllers: [EventsController, PublicEventsController],
  providers: [
    { provide: CATALOGUE_CONFIG, useFactory: () => loadCatalogueConfig() },
    { provide: BannerStorage, useFactory: () => bannerStorageFromEnv() },
    EventsRepository,
    EventsService,
  ],
})
export class CatalogueModule {}
