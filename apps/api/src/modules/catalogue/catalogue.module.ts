import { Module } from '@nestjs/common';
import { BannerStorage, bannerStorageFromEnv } from './banner-storage.js';
import { CATALOGUE_CONFIG, loadCatalogueConfig } from './catalogue.config.js';
import { EventsController } from './events.controller.js';
import { EventsRepository } from './events.repository.js';
import { EventsService } from './events.service.js';
import { PlacesController } from './places.controller.js';
import { PlacesProvider, placesProviderFromEnv } from './places.js';
import { PublicEventsController } from './public-events.controller.js';
import { PublicPageRevalidator, revalidatorFromEnv } from './revalidation.js';

/** Events and ticket types: drafting, venue lookup, publishing, the public event page and browse. */
@Module({
  controllers: [EventsController, PlacesController, PublicEventsController],
  providers: [
    { provide: CATALOGUE_CONFIG, useFactory: () => loadCatalogueConfig() },
    { provide: BannerStorage, useFactory: () => bannerStorageFromEnv() },
    { provide: PlacesProvider, useFactory: () => placesProviderFromEnv() },
    { provide: PublicPageRevalidator, useFactory: () => revalidatorFromEnv() },
    EventsRepository,
    EventsService,
  ],
  exports: [EventsService],
})
export class CatalogueModule {}
