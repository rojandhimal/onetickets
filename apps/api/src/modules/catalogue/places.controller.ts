import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import {
  placeSearchQuery,
  type PlaceDto,
  type PlaceSearchQuery,
  type PlaceSearchResponse,
} from '@onetickets/shared';
import { ApiError, SignedIn, ZodBody } from '../identity/index.js';
import { PlacesProvider } from './places.js';

/** Venue lookup for signed-in organisers (keeps the provider's quota away from the public). */
@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesProvider) {}

  @Get('search')
  @SignedIn()
  async search(
    @Query(new ZodBody(placeSearchQuery)) query: PlaceSearchQuery,
  ): Promise<PlaceSearchResponse> {
    return { items: await this.places.search(query.q, query.city) };
  }

  @Get(':placeId')
  @SignedIn()
  async get(@Param('placeId') placeId: string): Promise<PlaceDto> {
    const place = placeId.length <= 256 ? await this.places.get(placeId) : null;
    if (!place) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'place_not_found', 'Place not found.');
    }
    return place;
  }
}
