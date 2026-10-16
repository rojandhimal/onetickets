import { randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  CITY_TIME_ZONES,
  type BannerDto,
  type BrowseQuery,
  type BrowseResponse,
  type EventDraftDto,
  type EventDraftPatch,
  type EventTemplate,
  type PublicEventDto,
  type PublishNotReadyBody,
  type TicketTypeInput,
  type VenueInput,
} from '@onetickets/shared';
import type pg from 'pg';
import { UnitOfWork } from '../../database/database.module.js';
import { ApiError, recordAudit } from '../identity/index.js';
import { processBanner, UnsupportedImageError } from './banner-image.js';
import { BannerStorage, ogKeyFor } from './banner-storage.js';
import { CATALOGUE_CONFIG, type CatalogueConfig } from './catalogue.config.js';
import {
  type EventChanges,
  type EventRow,
  EventsRepository,
  type TicketTypeRow,
} from './events.repository.js';
import { toPlainLine, toPlainText } from './plain-text.js';
import { allInPriceCents } from './pricing.js';
import { missingForPublish, slugFor } from './publish-check.js';
import { PublicPageRevalidator } from './revalidation.js';
import { onSale, windowIsValid, type EventTimes } from './sales-window.js';
import { starterTicketType } from './templates.js';

/** Who is acting: the signed-in organiser, inside the organisation from the route. */
export interface Actor {
  organisationId: string;
  userId: string;
}

const eventNotFound = () =>
  new ApiError(HttpStatus.NOT_FOUND, 'event_not_found', 'Event not found.');

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly events: EventsRepository,
    private readonly storage: BannerStorage,
    private readonly revalidator: PublicPageRevalidator,
    @Inject(CATALOGUE_CONFIG) private readonly config: CatalogueConfig,
  ) {}

  /** A new draft from a template, with the template's starter ticket type. */
  async create(actor: Actor, template: EventTemplate): Promise<EventDraftDto> {
    return this.inScope(actor, async (tx) => {
      const event = await this.events.create(tx, actor.organisationId, template, actor.userId);
      await this.events.addTicketType(
        tx,
        { id: event.id, organisationId: actor.organisationId },
        starterTicketType(template),
      );
      await recordAudit(tx, actor.organisationId, actor.userId, 'event.created', null, {
        eventId: event.id,
        template,
      });
      return this.draftDto(tx, actor, event.id);
    });
  }

  async list(actor: Actor): Promise<EventDraftDto[]> {
    return this.inScope(actor, async (tx) => {
      const rows = await this.events.listFor(tx, actor.organisationId);
      const types = await this.events.ticketTypes(
        tx,
        rows.map((row) => row.id),
      );
      return rows.map((row) =>
        this.toDraftDto(
          row,
          types.filter((t) => t.event_id === row.id),
        ),
      );
    });
  }

  async get(actor: Actor, eventId: string): Promise<EventDraftDto> {
    return this.inScope(actor, (tx) => this.draftDto(tx, actor, eventId));
  }

  /** Autosave. A stale version gets 409 with the current draft so the client can reconcile. */
  async update(actor: Actor, eventId: string, patch: EventDraftPatch): Promise<EventDraftDto> {
    const result = await this.inScope(actor, async (tx) => {
      const event = await this.lockedEvent(tx, actor, eventId);
      if (event.version !== patch.version) {
        return { stale: await this.draftDto(tx, actor, eventId) };
      }
      const changes = this.changesFrom(patch);
      const startsAt = resolveTime(changes.starts_at, event.starts_at);
      const endsAt = resolveTime(changes.ends_at, event.ends_at);
      if (startsAt && endsAt && endsAt <= startsAt) {
        throw new ApiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'ends_before_start',
          'The event must end after it starts.',
          'endsAt',
        );
      }
      if (event.status === 'published') this.refuseUnpublishing(changes);
      const times = { startsAt, endsAt, publishedAt: event.published_at };
      const types = await this.events.ticketTypes(tx, [eventId]);
      if (types.some((t) => !windowIsValid(t.sales_start, t.sales_end, times))) {
        throw new ApiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'sales_end_before_start',
          'A ticket type would stop selling before it starts. Change its sales dates first.',
          'startsAt',
        );
      }
      await this.events.update(tx, eventId, changes);
      return { saved: await this.draftDto(tx, actor, eventId) };
    });
    if ('stale' in result) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'stale_draft',
        'This event changed elsewhere.',
        undefined,
        {
          current: result.stale,
        },
      );
    }
    return this.announce(result.saved);
  }

  async addTicketType(actor: Actor, eventId: string, raw: TicketTypeInput): Promise<EventDraftDto> {
    const input = cleanTicketType(raw);
    this.refusePaid(input);
    const dto = await this.inScope(actor, async (tx) => {
      const event = await this.lockedEvent(tx, actor, eventId);
      this.checkWindow(event, input);
      await this.events.addTicketType(
        tx,
        { id: eventId, organisationId: actor.organisationId },
        input,
      );
      await this.events.bumpVersion(tx, eventId);
      return this.draftDto(tx, actor, eventId);
    });
    return this.announce(dto);
  }

  async updateTicketType(
    actor: Actor,
    eventId: string,
    ticketTypeId: string,
    raw: TicketTypeInput,
  ): Promise<EventDraftDto> {
    const input = cleanTicketType(raw);
    this.refusePaid(input);
    const dto = await this.inScope(actor, async (tx) => {
      const event = await this.lockedEvent(tx, actor, eventId);
      this.checkWindow(event, input);
      const updated = await this.events
        .updateTicketType(tx, eventId, ticketTypeId, input)
        .catch(inventoryConflict);
      if (!updated) throw ticketTypeNotFound();
      await this.events.bumpVersion(tx, eventId);
      return this.draftDto(tx, actor, eventId);
    });
    return this.announce(dto);
  }

  /** Bookings arrive in Sprint 2; until then the only refusal is a published event's last type. */
  async removeTicketType(
    actor: Actor,
    eventId: string,
    ticketTypeId: string,
  ): Promise<EventDraftDto> {
    const dto = await this.inScope(actor, async (tx) => {
      const event = await this.lockedEvent(tx, actor, eventId);
      const types = await this.events.ticketTypes(tx, [eventId]);
      if (!types.some((t) => t.id === ticketTypeId)) throw ticketTypeNotFound();
      if (event.status === 'published' && types.length === 1) {
        throw new ApiError(
          HttpStatus.CONFLICT,
          'last_ticket_type',
          'A live event needs at least one ticket type.',
        );
      }
      await this.events.removeTicketType(tx, eventId, ticketTypeId).catch(inventoryConflict);
      await this.events.bumpVersion(tx, eventId);
      return this.draftDto(tx, actor, eventId);
    });
    return this.announce(dto);
  }

  /** Re-encodes the upload, stores it under a fresh key and drops the previous banner. */
  async setBanner(actor: Actor, eventId: string, upload: Buffer): Promise<EventDraftDto> {
    let processed;
    try {
      processed = await processBanner(upload);
    } catch (error) {
      if (error instanceof UnsupportedImageError) {
        throw new ApiError(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          'unsupported_image',
          'Use a JPG, PNG or WebP image.',
        );
      }
      throw error;
    }
    const key = `${randomUUID()}.webp`;
    await this.storage.put(key, processed.image);
    await this.storage.put(ogKeyFor(key), processed.ogImage);
    let previous: string | null = null;
    try {
      const dto = await this.inScope(actor, async (tx) => {
        const event = await this.lockedEvent(tx, actor, eventId);
        previous = event.banner_key;
        await this.events.setBanner(tx, eventId, {
          key,
          width: processed.width,
          height: processed.height,
        });
        return this.draftDto(tx, actor, eventId);
      });
      if (previous) await this.removeStored(previous);
      return this.announce(dto);
    } catch (error) {
      await this.removeStored(key);
      throw error;
    }
  }

  async removeBanner(actor: Actor, eventId: string): Promise<EventDraftDto> {
    let previous: string | null = null;
    const dto = await this.inScope(actor, async (tx) => {
      const event = await this.lockedEvent(tx, actor, eventId);
      previous = event.banner_key;
      if (previous) await this.events.setBanner(tx, eventId, null);
      return this.draftDto(tx, actor, eventId);
    });
    if (previous) await this.removeStored(previous);
    return this.announce(dto);
  }

  async publish(actor: Actor, eventId: string): Promise<EventDraftDto> {
    const dto = await this.inScope(actor, async (tx) => {
      const event = await this.lockedEvent(tx, actor, eventId);
      if (event.status === 'published') return this.draftDto(tx, actor, eventId);
      const types = await this.events.ticketTypes(tx, [eventId]);
      const missing = missingForPublish(
        {
          name: event.name,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          hasVenue: event.venue !== null,
          ticketTypeCount: types.length,
        },
        new Date(),
      );
      if (missing.length > 0) {
        throw new ApiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'not_ready' satisfies PublishNotReadyBody['code'],
          'Some things are needed before this event can go live.',
          undefined,
          { missing } satisfies Pick<PublishNotReadyBody, 'missing'>,
        );
      }
      const slug = slugFor(
        event.name!,
        randomBytes(4).readUInt32BE().toString(36).padStart(7, '0'),
      );
      await this.events.publish(tx, eventId, slug, actor.userId);
      await recordAudit(tx, actor.organisationId, actor.userId, 'event.published', null, {
        eventId,
        slug,
      });
      return this.draftDto(tx, actor, eventId);
    });
    return this.announce(dto);
  }

  /** After a committed change to a live event, tell the web app its public page changed. */
  private announce(dto: EventDraftDto): EventDraftDto {
    if (dto.status === 'published' && dto.slug) this.revalidator.changed(dto.slug);
    return dto;
  }

  // ---------- public ----------

  async publicEvent(slug: string): Promise<PublicEventDto | null> {
    return this.uow.run({}, async (tx) => {
      const event = await this.events.findPublished(tx, slug);
      if (!event) return null;
      const now = new Date();
      const types = await this.events.ticketTypes(tx, [event.id]);
      const organiser = await this.events.organiserName(tx, event.organisation_id);
      const fromCents = await this.events.fromPriceCents(tx, event.id, now);
      return this.toPublicDto(event, types, organiser ?? '', fromCents, now);
    });
  }

  async browse(query: BrowseQuery): Promise<BrowseResponse> {
    const after = query.cursor ? decodeCursor(query.cursor) : undefined;
    const now = new Date();
    const { rows } = await this.uow.run({}, async (tx) => {
      const rows = await this.events.browse(tx, {
        city: query.city,
        timeZone: CITY_TIME_ZONES[query.city],
        when: query.when,
        price: query.price,
        after,
        limit: query.limit + 1,
        now,
      });
      return { rows };
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        slug: row.slug!,
        name: row.name!,
        startsAt: row.starts_at!.toISOString(),
        timeZone: row.time_zone,
        template: row.template,
        suburb: row.venue?.kind === 'place' ? row.venue.suburb : null,
        venueName: row.venue?.kind === 'place' ? row.venue.name : null,
        online: row.venue?.kind === 'online',
        banner: this.bannerDto(row),
        priceFromAllInCents: allInPriceCents(row.price_from_cents),
      })),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor(last.starts_at!.toISOString(), last.id)
          : null,
    };
  }

  /** Banner bytes for the api's own route, when storage is local. */
  async bannerBytes(key: string): Promise<Buffer | null> {
    return this.storage.read(key);
  }

  // ---------- helpers ----------

  private inScope<T>(actor: Actor, work: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
    return this.uow.run({ organisationId: actor.organisationId, userId: actor.userId }, work);
  }

  private async lockedEvent(tx: pg.PoolClient, actor: Actor, eventId: string): Promise<EventRow> {
    const event = await this.events.find(tx, actor.organisationId, eventId, true);
    if (!event) throw eventNotFound();
    return event;
  }

  private async draftDto(tx: pg.PoolClient, actor: Actor, eventId: string): Promise<EventDraftDto> {
    const event = await this.events.find(tx, actor.organisationId, eventId);
    if (!event) throw eventNotFound();
    return this.toDraftDto(event, await this.events.ticketTypes(tx, [eventId]));
  }

  private changesFrom(patch: EventDraftPatch): EventChanges {
    return {
      name:
        patch.name === undefined || patch.name === null
          ? patch.name
          : plainLineOrRefuse(patch.name, 'name'),
      starts_at: patch.startsAt,
      ends_at: patch.endsAt,
      time_zone: patch.timeZone === undefined ? undefined : validTimeZone(patch.timeZone),
      venue: patch.venue ? cleanVenue(patch.venue) : patch.venue,
      city:
        patch.venue === undefined
          ? undefined
          : patch.venue?.kind === 'place'
            ? patch.venue.city
            : null,
      about: patch.about === undefined ? undefined : toPlainText(patch.about),
      accessibility_features: patch.accessibility
        ? [...new Set(patch.accessibility.features)]
        : undefined,
      accessibility_notes: patch.accessibility ? toPlainText(patch.accessibility.notes) : undefined,
      cancellation_policy: patch.cancellationPolicy,
      contact_email: patch.contactEmail,
      banner_focus_x: patch.bannerFocus?.x,
      banner_focus_y: patch.bannerFocus?.y,
      last_step: patch.lastStep,
    };
  }

  /** A live event keeps what publishing needed: these can change but not be cleared. */
  private refuseUnpublishing(changes: EventChanges): void {
    const cleared = (
      [
        ['name', changes.name],
        ['startsAt', changes.starts_at],
        ['endsAt', changes.ends_at],
        ['venue', changes.venue],
      ] as const
    ).find(([, value]) => value === null);
    if (cleared) {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'required_when_live',
        'A live event needs a name, start and end times, and a venue or online link.',
        cleared[0],
      );
    }
  }

  private refusePaid(input: TicketTypeInput): void {
    if (input.priceCents > 0 && !this.config.paidTickets) {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'paid_tickets_disabled',
        'Paid tickets are not available yet.',
        'priceCents',
      );
    }
  }

  private checkWindow(event: EventRow, input: TicketTypeInput): void {
    if (!windowIsValid(input.salesStart, input.salesEnd, times(event))) {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'sales_end_before_start',
        'Sales must end after they start.',
        'salesEnd',
      );
    }
  }

  /** Removes a banner and its link-preview image. A leftover file is only logged. */
  private async removeStored(key: string): Promise<void> {
    for (const stored of [key, ogKeyFor(key)]) {
      await this.storage.remove(stored).catch((error: unknown) => {
        this.logger.warn(`Could not remove banner ${stored}: ${String(error)}`);
      });
    }
  }

  private bannerDto(row: EventRow): BannerDto | null {
    if (!row.banner_key) return null;
    return {
      url: this.storage.publicUrl(row.banner_key),
      ogUrl: this.storage.publicUrl(ogKeyFor(row.banner_key)),
      width: row.banner_width!,
      height: row.banner_height!,
      focus: { x: row.banner_focus_x, y: row.banner_focus_y },
    };
  }

  private toDraftDto(row: EventRow, types: TicketTypeRow[]): EventDraftDto {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      status: row.status,
      version: row.version,
      template: row.template,
      name: row.name,
      startsAt: row.starts_at?.toISOString() ?? null,
      endsAt: row.ends_at?.toISOString() ?? null,
      timeZone: row.time_zone,
      venue: row.venue,
      about: row.about,
      accessibility: { features: row.accessibility_features, notes: row.accessibility_notes },
      cancellationPolicy: row.cancellation_policy,
      contactEmail: row.contact_email,
      banner: this.bannerDto(row),
      lastStep: row.last_step,
      ticketTypes: types.map((t) => ({
        id: t.id,
        name: t.name,
        capacity: t.capacity,
        maxPerOrder: t.max_per_order,
        priceCents: t.price_cents,
        salesStart: t.sales_start,
        salesEnd: t.sales_end,
        sold: t.sold,
      })),
      slug: row.slug,
      publishedAt: row.published_at?.toISOString() ?? null,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toPublicDto(
    row: EventRow,
    types: TicketTypeRow[],
    organiser: string,
    fromCents: number,
    now: Date,
  ): PublicEventDto {
    const ticketTypes = types.map((t) => ({
      id: t.id,
      name: t.name,
      allInPriceCents: allInPriceCents(t.price_cents),
      spotsLeft: t.capacity - t.sold - t.held,
      onSale: onSale(t.sales_start, t.sales_end, times(row), now),
      maxPerOrder: t.max_per_order,
    }));
    const venue = row.venue!;
    return {
      slug: row.slug!,
      name: row.name!,
      startsAt: row.starts_at!.toISOString(),
      endsAt: row.ends_at!.toISOString(),
      timeZone: row.time_zone,
      template: row.template,
      organiser: { name: organiser },
      // The online link is only for ticket holders.
      venue: venue.kind === 'online' ? { kind: 'online' } : venue,
      about: row.about,
      accessibility: { features: row.accessibility_features, notes: row.accessibility_notes },
      cancellationPolicy: row.cancellation_policy,
      hasContactEmail: row.contact_email !== null,
      banner: this.bannerDto(row),
      priceFromAllInCents: allInPriceCents(fromCents),
      spotsLeft: ticketTypes.reduce((sum, t) => sum + t.spotsLeft, 0),
      ticketTypes,
    };
  }
}

/**
 * The database refused an inventory change (INV-1): capacity below what is sold or held, or
 * deleting a type that has tickets sold or held.
 */
function inventoryConflict(error: unknown): never {
  const code = (error as { code?: string }).code;
  if (code === '23514' || code === '23001') {
    throw new ApiError(
      HttpStatus.CONFLICT,
      'tickets_sold_or_held',
      'Some of these tickets are already sold or held.',
    );
  }
  throw error;
}

const ticketTypeNotFound = () =>
  new ApiError(HttpStatus.NOT_FOUND, 'ticket_type_not_found', 'Ticket type not found.');

/** A patched time: undefined keeps the stored one, null clears it. */
function resolveTime(value: string | null | undefined, stored: Date | null): Date | null {
  if (value === undefined) return stored;
  return value === null ? null : new Date(value);
}

/** Single-line text that must not end up empty once spoofing characters are removed. */
function plainLineOrRefuse(value: string, field: string): string {
  const clean = toPlainLine(value);
  if (!clean) {
    throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'invalid_request', 'Required.', field);
  }
  return clean;
}

function cleanVenue(venue: VenueInput): VenueInput {
  if (venue.kind === 'online') return venue;
  return {
    ...venue,
    name: plainLineOrRefuse(venue.name, 'venue'),
    address: plainLineOrRefuse(venue.address, 'venue'),
    suburb: plainLineOrRefuse(venue.suburb, 'venue'),
  };
}

function cleanTicketType(input: TicketTypeInput): TicketTypeInput {
  return { ...input, name: plainLineOrRefuse(input.name, 'name') };
}

function times(row: EventRow): EventTimes {
  return { startsAt: row.starts_at, endsAt: row.ends_at, publishedAt: row.published_at };
}

function validTimeZone(zone: string): string {
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: zone });
    return zone;
  } catch {
    throw new ApiError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'invalid_request',
      'Unknown time zone.',
      'timeZone',
    );
  }
}

function encodeCursor(startsAt: string, id: string): string {
  return Buffer.from(`${startsAt}|${id}`).toString('base64url');
}

const CURSOR = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\|([0-9a-f-]{36})$/;

function decodeCursor(cursor: string): { startsAt: string; id: string } {
  const match = CURSOR.exec(Buffer.from(cursor, 'base64url').toString());
  if (!match) {
    throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'invalid_request', 'Bad cursor.', 'cursor');
  }
  return { startsAt: match[1]!, id: match[2]! };
}
