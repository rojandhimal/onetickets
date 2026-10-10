import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import {
  browseQuery,
  type BrowseQuery,
  type BrowseResponse,
  type PublicEventDto,
} from '@onetickets/shared';
import type { Response } from 'express';
import { ApiError, Public, ZodBody } from '../identity/index.js';
import { BANNER_KEY } from './banner-storage.js';
import { EventsService } from './events.service.js';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const notFound = () => new ApiError(HttpStatus.NOT_FOUND, 'event_not_found', 'Event not found.');

/** Anyone may read published events. Drafts are never visible here. */
@Controller('public')
export class PublicEventsController {
  constructor(private readonly events: EventsService) {}

  @Get('events')
  @Public()
  async browse(@Query(new ZodBody(browseQuery)) query: BrowseQuery): Promise<BrowseResponse> {
    return this.events.browse(query);
  }

  @Get('events/:slug')
  @Public()
  async event(@Param('slug') slug: string): Promise<PublicEventDto> {
    if (slug.length > 80 || !SLUG.test(slug)) throw notFound();
    const event = await this.events.publicEvent(slug);
    if (!event) throw notFound();
    return event;
  }

  /** Banners stored on local disk (development). In AWS they come from the CDN instead. */
  @Get('banners/:key')
  @Public()
  async banner(@Param('key') key: string, @Res() response: Response): Promise<void> {
    const image = BANNER_KEY.test(key) ? await this.events.bannerBytes(key) : null;
    if (!image) {
      response.status(404).end();
      return;
    }
    response
      .status(200)
      .set({
        'content-type': 'image/webp',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      })
      .send(image);
  }
}
