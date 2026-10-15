import type { City, PlaceDto, PlaceSuggestionDto } from '@onetickets/shared';

/**
 * Venue lookup for the wizard. The browser never talks to the places provider directly, so its
 * key stays on the server and lookups can be rate limited in one place.
 */
export abstract class PlacesProvider {
  abstract search(query: string, city: City): Promise<PlaceSuggestionDto[]>;
  abstract get(placeId: string): Promise<PlaceDto | null>;
}

const FAKE_PLACES: PlaceDto[] = [
  {
    kind: 'place',
    placeId: 'fake-marrickville-town-hall',
    name: 'Marrickville Town Hall',
    address: '303 Marrickville Rd, Marrickville NSW 2204',
    suburb: 'Marrickville',
    city: 'sydney',
    lat: -33.9112,
    lng: 151.1552,
  },
  {
    kind: 'place',
    placeId: 'fake-the-red-rattler',
    name: 'The Red Rattler',
    address: '6 Faversham St, Marrickville NSW 2204',
    suburb: 'Marrickville',
    city: 'sydney',
    lat: -33.9105,
    lng: 151.1626,
  },
  {
    kind: 'place',
    placeId: 'fake-paddington-town-hall',
    name: 'Paddington Town Hall',
    address: '249 Oxford St, Paddington NSW 2021',
    suburb: 'Paddington',
    city: 'sydney',
    lat: -33.8846,
    lng: 151.2262,
  },
  {
    kind: 'place',
    placeId: 'fake-newtown-community-centre',
    name: 'Newtown Community Centre',
    address: '1 Bedford St, Newtown NSW 2042',
    suburb: 'Newtown',
    city: 'sydney',
    lat: -33.8978,
    lng: 151.1786,
  },
  {
    kind: 'place',
    placeId: 'fake-the-tote',
    name: 'The Tote',
    address: '67-71 Johnston St, Collingwood VIC 3066',
    suburb: 'Collingwood',
    city: 'melbourne',
    lat: -37.7983,
    lng: 144.9877,
  },
  {
    kind: 'place',
    placeId: 'fake-fitzroy-town-hall',
    name: 'Fitzroy Town Hall',
    address: '201 Napier St, Fitzroy VIC 3065',
    suburb: 'Fitzroy',
    city: 'melbourne',
    lat: -37.8008,
    lng: 144.9784,
  },
  {
    kind: 'place',
    placeId: 'fake-brunswick-mechanics-institute',
    name: 'Brunswick Mechanics Institute',
    address: '270 Sydney Rd, Brunswick VIC 3056',
    suburb: 'Brunswick',
    city: 'melbourne',
    lat: -37.7685,
    lng: 144.9611,
  },
];

/** A fixed list of real venues, for development and tests until a provider is chosen. */
export class FakePlacesProvider extends PlacesProvider {
  async search(query: string, city: City): Promise<PlaceSuggestionDto[]> {
    const needle = query.toLowerCase();
    return FAKE_PLACES.filter(
      (place) =>
        place.city === city && `${place.name} ${place.address}`.toLowerCase().includes(needle),
    )
      .slice(0, 5)
      .map(({ placeId, name, address }) => ({ placeId, name, address }));
  }

  async get(placeId: string): Promise<PlaceDto | null> {
    return FAKE_PLACES.find((place) => place.placeId === placeId) ?? null;
  }
}

export function placesProviderFromEnv(env: NodeJS.ProcessEnv = process.env): PlacesProvider {
  const provider = env.PLACES_PROVIDER ?? 'fake';
  if (provider !== 'fake') throw new Error(`PLACES_PROVIDER=${provider} is not supported yet`);
  return new FakePlacesProvider();
}
