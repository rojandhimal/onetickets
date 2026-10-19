import { z } from 'zod';

/**
 * API contract for events and ticket types (Sprint 1: create, publish and browse). Shared by api
 * and web. Organiser routes live under /organisations/:organisationId/events and need the
 * `manageEvents` permission; public routes live under /public/events and need no session.
 */

export const EVENT_TEMPLATES = ['workshop', 'gig', 'school_night', 'meetup', 'blank'] as const;
export const eventTemplate = z.enum(EVENT_TEMPLATES);
export type EventTemplate = z.infer<typeof eventTemplate>;

export const EVENT_STATUSES = ['draft', 'published'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const WIZARD_STEPS = ['basics', 'tickets', 'details', 'review'] as const;
export const wizardStep = z.enum(WIZARD_STEPS);
export type WizardStep = z.infer<typeof wizardStep>;

export const ACCESSIBILITY_FEATURES = [
  'step_free_access',
  'accessible_toilet',
  'hearing_loop',
  'seating_available',
  'auslan_interpreter',
  'quiet_space',
] as const;
export const accessibilityFeature = z.enum(ACCESSIBILITY_FEATURES);
export type AccessibilityFeature = z.infer<typeof accessibilityFeature>;

export const CANCELLATION_POLICIES = ['any_time', 'up_to_24h', 'none'] as const;
export const cancellationPolicy = z.enum(CANCELLATION_POLICIES);
export type CancellationPolicy = z.infer<typeof cancellationPolicy>;

export const CITIES = ['sydney', 'melbourne'] as const;
export const city = z.enum(CITIES);
export type City = z.infer<typeof city>;

/** Time zone each launch city's "tonight" and "this weekend" are worked out in. */
export const CITY_TIME_ZONES: Record<City, string> = {
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
};

/** Limits the wizard shows as live counts. */
export const EVENT_LIMITS = {
  name: 120,
  about: 2000,
  accessibilityNotes: 500,
  ticketTypeName: 80,
  capacity: 100_000,
  maxPerOrder: 100,
  /** Ticket price in cents (A$10,000). */
  priceCents: 1_000_000,
  /** Banner upload size in bytes. */
  bannerBytes: 10 * 1024 * 1024,
} as const;

export const BANNER_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const isoDateTime = z.iso.datetime({ offset: true });

// ---------- venue ----------

export const venueInput = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('place'),
    placeId: z.string().min(1).max(256),
    name: z.string().trim().min(1).max(160),
    address: z.string().trim().min(1).max(300),
    suburb: z.string().trim().min(1).max(80),
    city,
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  z.object({
    kind: z.literal('online'),
    url: z.url({ protocol: /^https$/ }).max(2048),
  }),
]);
export type VenueInput = z.infer<typeof venueInput>;

// ---------- venue lookup (S1-1 basics step) ----------

/** GET /places/search: suggestions for the venue combobox. */
export const placeSearchQuery = z.object({
  q: z.string().trim().min(2).max(100),
  city: city.default('sydney'),
});
export type PlaceSearchQuery = z.infer<typeof placeSearchQuery>;

export interface PlaceSuggestionDto {
  placeId: string;
  name: string;
  address: string;
}

export interface PlaceSearchResponse {
  items: PlaceSuggestionDto[];
}

/** GET /places/:placeId: the full venue to put in the draft's `venue`. */
export type PlaceDto = Extract<VenueInput, { kind: 'place' }>;

/** What the public sees of a venue. An online event's link is only for ticket holders. */
export type PublicVenueDto = Exclude<VenueInput, { kind: 'online' }> | { kind: 'online' };

// ---------- event draft ----------

/**
 * Autosave body for PATCH. Every field is optional except `version`, the version the client last
 * saw: a stale one gets 409 `stale_draft` with the current draft in `current`. `null` clears a
 * field (refused with 422 `required_when_live` for what a live event needs). A bad field gets 422
 * with `field` set, so the client can drop it and save the rest.
 *
 * `about` and `accessibility.notes` are plain text (SEC-3). The api strips markup and control
 * characters; the web renders them as text with line breaks, never as HTML.
 */
export const eventDraftPatch = z
  .object({
    version: z.int().min(0),
    name: z.string().trim().min(1).max(EVENT_LIMITS.name).nullable(),
    startsAt: isoDateTime.nullable(),
    endsAt: isoDateTime.nullable(),
    /** IANA zone the organiser picked times in, e.g. Australia/Sydney. */
    timeZone: z.string().min(1).max(64),
    venue: venueInput.nullable(),
    about: z.string().max(EVENT_LIMITS.about),
    accessibility: z.object({
      features: z.array(accessibilityFeature).max(ACCESSIBILITY_FEATURES.length),
      notes: z.string().max(EVENT_LIMITS.accessibilityNotes),
    }),
    cancellationPolicy,
    contactEmail: z.string().trim().toLowerCase().max(254).pipe(z.email()).nullable(),
    /** Banner focal point from "Adjust crop", 0 to 1 each way. The image is uploaded separately. */
    bannerFocus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
    lastStep: wizardStep,
  })
  .partial()
  .required({ version: true })
  .refine((e) => !e.startsAt || !e.endsAt || Date.parse(e.endsAt) > Date.parse(e.startsAt), {
    path: ['endsAt'],
    message: 'ends_before_start',
  });
export type EventDraftPatch = z.infer<typeof eventDraftPatch>;

export const createEventRequest = z.object({ template: eventTemplate });
export type CreateEventRequest = z.infer<typeof createEventRequest>;

// ---------- ticket types ----------

export const salesStart = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('on_publish') }),
  z.object({ kind: z.literal('at'), at: isoDateTime }),
]);
export type SalesStart = z.infer<typeof salesStart>;

export const SALES_END_RELATIVE = [
  'event_start',
  'hour_before',
  'day_before',
  'event_end',
] as const;
export const salesEnd = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(SALES_END_RELATIVE) }),
  z.object({ kind: z.literal('at'), at: isoDateTime }),
]);
export type SalesEnd = z.infer<typeof salesEnd>;

/**
 * One ticket type. `priceCents` must be 0 while the `paid_tickets` flag is off (422
 * `paid_tickets_disabled`). The api also checks the resolved sales end is after the resolved
 * sales start once the event's times are known.
 */
export const ticketTypeInput = z
  .object({
    name: z.string().trim().min(1).max(EVENT_LIMITS.ticketTypeName),
    capacity: z.int().min(1).max(EVENT_LIMITS.capacity),
    maxPerOrder: z.int().min(1).max(EVENT_LIMITS.maxPerOrder),
    priceCents: z.int().min(0).max(EVENT_LIMITS.priceCents),
    salesStart,
    salesEnd,
  })
  .refine((t) => t.maxPerOrder <= t.capacity, {
    path: ['maxPerOrder'],
    message: 'max_per_order_over_capacity',
  })
  .refine(
    (t) =>
      t.salesStart.kind !== 'at' ||
      t.salesEnd.kind !== 'at' ||
      Date.parse(t.salesEnd.at) > Date.parse(t.salesStart.at),
    { path: ['salesEnd'], message: 'sales_end_before_start' },
  );
export type TicketTypeInput = z.infer<typeof ticketTypeInput>;

// ---------- responses ----------

export interface TicketTypeDto extends TicketTypeInput {
  id: string;
  /** Tickets booked so far. 0 until bookings exist (Sprint 2). */
  sold: number;
}

export interface BannerDto {
  /** A 2:1 WebP rendition. The web never builds image URLs itself. */
  url: string;
  /** 1200 × 630 JPEG of the same banner, for link previews (og:image). */
  ogUrl: string;
  width: number;
  height: number;
  focus: { x: number; y: number };
}

/** An event as its organisers see it, draft or published. */
export interface EventDraftDto {
  id: string;
  organisationId: string;
  status: EventStatus;
  version: number;
  template: EventTemplate;
  name: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  venue: VenueInput | null;
  about: string;
  accessibility: { features: AccessibilityFeature[]; notes: string };
  cancellationPolicy: CancellationPolicy;
  contactEmail: string | null;
  banner: BannerDto | null;
  lastStep: WizardStep;
  ticketTypes: TicketTypeDto[];
  /** Set once published; the public page is /e/{slug}. */
  slug: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

/** 409 body from an autosave that sent an old `version` (code `stale_draft`). */
export interface StaleDraftBody {
  statusCode: 409;
  code: 'stale_draft';
  message: string;
  /** The draft as it is now, to reconcile with the unsaved changes. */
  current: EventDraftDto;
}

export interface EventListDto {
  items: EventDraftDto[];
}

/** What publishing needs. `date_time` means both start and end, with the end after the start. */
export const PUBLISH_REQUIREMENTS = [
  'name',
  'date_time',
  'venue',
  'ticket_type',
  'contact_email',
] as const;
export type PublishRequirement = (typeof PUBLISH_REQUIREMENTS)[number];

/** 422 body from publish when something needed is missing (code `not_ready`). */
export interface PublishNotReadyBody {
  statusCode: 422;
  code: 'not_ready';
  message: string;
  missing: PublishRequirement[];
}

export interface PublicTicketTypeDto {
  id: string;
  name: string;
  /** What the buyer pays, fees included. */
  allInPriceCents: number;
  spotsLeft: number;
  onSale: boolean;
  maxPerOrder: number;
}

/** The public event page (S1-3). No organiser-private fields. */
export interface PublicEventDto {
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  template: EventTemplate;
  organiser: { name: string };
  venue: PublicVenueDto;
  about: string;
  accessibility: { features: AccessibilityFeature[]; notes: string };
  cancellationPolicy: CancellationPolicy;
  /** Whether the organiser left a contact email for attendees (the address itself is private). */
  hasContactEmail: boolean;
  banner: BannerDto | null;
  /**
   * Lowest all-in price across the types on sale, or across all types if none is on sale (the
   * api's one pricing function; browse cards use the same).
   */
  priceFromAllInCents: number;
  spotsLeft: number;
  ticketTypes: PublicTicketTypeDto[];
}

// ---------- browse (S1-5) ----------

export const BROWSE_WHEN = ['tonight', 'this_weekend', 'next_7_days'] as const;

export const browseQuery = z.object({
  city: city.default('sydney'),
  when: z.enum(BROWSE_WHEN).optional(),
  price: z.enum(['free', 'paid']).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type BrowseQuery = z.infer<typeof browseQuery>;

export interface BrowseCardDto {
  slug: string;
  name: string;
  startsAt: string;
  timeZone: string;
  template: EventTemplate;
  suburb: string | null;
  venueName: string | null;
  online: boolean;
  banner: BannerDto | null;
  priceFromAllInCents: number;
}

export interface BrowseResponse {
  items: BrowseCardDto[];
  nextCursor: string | null;
}
