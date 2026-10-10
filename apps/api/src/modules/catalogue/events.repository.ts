import { Injectable } from '@nestjs/common';
import type {
  AccessibilityFeature,
  CancellationPolicy,
  EventStatus,
  EventTemplate,
  SalesEnd,
  SalesStart,
  TicketTypeInput,
  VenueInput,
  WizardStep,
} from '@onetickets/shared';
import type pg from 'pg';

export interface EventRow {
  id: string;
  organisation_id: string;
  status: EventStatus;
  version: number;
  template: EventTemplate;
  name: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  time_zone: string;
  venue: VenueInput | null;
  about: string;
  accessibility_features: AccessibilityFeature[];
  accessibility_notes: string;
  cancellation_policy: CancellationPolicy;
  contact_email: string | null;
  banner_key: string | null;
  banner_width: number | null;
  banner_height: number | null;
  banner_focus_x: number;
  banner_focus_y: number;
  last_step: WizardStep;
  slug: string | null;
  published_at: Date | null;
  updated_at: Date;
}

export interface TicketTypeRow {
  id: string;
  event_id: string;
  name: string;
  capacity: number;
  max_per_order: number;
  price_cents: number;
  sales_start: SalesStart;
  sales_end: SalesEnd;
}

/** Columns an autosave may set, already validated and sanitised by the service. */
export interface EventChanges {
  name?: string;
  starts_at?: string;
  ends_at?: string;
  time_zone?: string;
  venue?: VenueInput | null;
  city?: string | null;
  about?: string;
  accessibility_features?: AccessibilityFeature[];
  accessibility_notes?: string;
  cancellation_policy?: CancellationPolicy;
  contact_email?: string | null;
  banner_focus_x?: number;
  banner_focus_y?: number;
  last_step?: WizardStep;
}

export interface BrowseRow extends EventRow {
  price_from_cents: number;
}

const EVENT_COLUMNS = `id, organisation_id, status, version, template, name, starts_at, ends_at,
  time_zone, venue, about, accessibility_features, accessibility_notes, cancellation_policy,
  contact_email, banner_key, banner_width, banner_height, banner_focus_x, banner_focus_y,
  last_step, slug, published_at, updated_at`;

const TICKET_TYPE_COLUMNS = `id, event_id, name, capacity, max_per_order, price_cents,
  sales_start, sales_end`;

/** SQL for the catalogue schema. Every call runs inside a UnitOfWork transaction. */
@Injectable()
export class EventsRepository {
  async create(
    tx: pg.PoolClient,
    organisationId: string,
    template: EventTemplate,
    createdBy: string,
  ): Promise<EventRow> {
    const { rows } = await tx.query<EventRow>(
      `insert into catalogue.events (organisation_id, template, created_by)
       values ($1, $2, $3) returning ${EVENT_COLUMNS}`,
      [organisationId, template, createdBy],
    );
    return rows[0]!;
  }

  async listFor(tx: pg.PoolClient, organisationId: string): Promise<EventRow[]> {
    const { rows } = await tx.query<EventRow>(
      `select ${EVENT_COLUMNS} from catalogue.events
       where organisation_id = $1 order by updated_at desc limit 200`,
      [organisationId],
    );
    return rows;
  }

  /** The organisation's event, locked for update when `lock` is set. */
  async find(
    tx: pg.PoolClient,
    organisationId: string,
    eventId: string,
    lock = false,
  ): Promise<EventRow | null> {
    const { rows } = await tx.query<EventRow>(
      `select ${EVENT_COLUMNS} from catalogue.events
       where id = $1 and organisation_id = $2 ${lock ? 'for update' : ''}`,
      [eventId, organisationId],
    );
    return rows[0] ?? null;
  }

  /** Applies changes and bumps the version. The caller has locked the row and checked it. */
  async update(tx: pg.PoolClient, eventId: string, changes: EventChanges): Promise<void> {
    const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
    const sets = entries.map(([column], i) => `${column} = $${i + 2}`);
    const values = entries.map(([column, value]) =>
      column === 'venue' && value !== null ? JSON.stringify(value) : value,
    );
    await tx.query(
      `update catalogue.events
       set ${[...sets, 'version = version + 1', 'updated_at = now()'].join(', ')}
       where id = $1`,
      [eventId, ...values],
    );
  }

  async setBanner(
    tx: pg.PoolClient,
    eventId: string,
    banner: { key: string; width: number; height: number } | null,
  ): Promise<void> {
    await tx.query(
      `update catalogue.events
       set banner_key = $2, banner_width = $3, banner_height = $4,
           version = version + 1, updated_at = now()
       where id = $1`,
      [eventId, banner?.key ?? null, banner?.width ?? null, banner?.height ?? null],
    );
  }

  async publish(tx: pg.PoolClient, eventId: string, slug: string): Promise<void> {
    await tx.query(
      `update catalogue.events
       set status = 'published', slug = $2, published_at = now(),
           version = version + 1, updated_at = now()
       where id = $1`,
      [eventId, slug],
    );
  }

  async bumpVersion(tx: pg.PoolClient, eventId: string): Promise<void> {
    await tx.query(
      'update catalogue.events set version = version + 1, updated_at = now() where id = $1',
      [eventId],
    );
  }

  async ticketTypes(tx: pg.PoolClient, eventIds: string[]): Promise<TicketTypeRow[]> {
    if (eventIds.length === 0) return [];
    const { rows } = await tx.query<TicketTypeRow>(
      `select ${TICKET_TYPE_COLUMNS} from catalogue.ticket_types
       where event_id = any($1::uuid[]) order by position, created_at`,
      [eventIds],
    );
    return rows;
  }

  async addTicketType(
    tx: pg.PoolClient,
    event: { id: string; organisationId: string },
    input: TicketTypeInput,
  ): Promise<string> {
    const { rows } = await tx.query<{ id: string }>(
      `insert into catalogue.ticket_types
         (event_id, organisation_id, name, capacity, max_per_order, price_cents, sales_start,
          sales_end, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8,
         (select coalesce(max(position) + 1, 0) from catalogue.ticket_types where event_id = $1))
       returning id`,
      [
        event.id,
        event.organisationId,
        input.name,
        input.capacity,
        input.maxPerOrder,
        input.priceCents,
        JSON.stringify(input.salesStart),
        JSON.stringify(input.salesEnd),
      ],
    );
    return rows[0]!.id;
  }

  async updateTicketType(
    tx: pg.PoolClient,
    eventId: string,
    ticketTypeId: string,
    input: TicketTypeInput,
  ): Promise<boolean> {
    const { rowCount } = await tx.query(
      `update catalogue.ticket_types
       set name = $3, capacity = $4, max_per_order = $5, price_cents = $6, sales_start = $7,
           sales_end = $8, updated_at = now()
       where id = $2 and event_id = $1`,
      [
        eventId,
        ticketTypeId,
        input.name,
        input.capacity,
        input.maxPerOrder,
        input.priceCents,
        JSON.stringify(input.salesStart),
        JSON.stringify(input.salesEnd),
      ],
    );
    return rowCount === 1;
  }

  async removeTicketType(
    tx: pg.PoolClient,
    eventId: string,
    ticketTypeId: string,
  ): Promise<boolean> {
    const { rowCount } = await tx.query(
      'delete from catalogue.ticket_types where id = $2 and event_id = $1',
      [eventId, ticketTypeId],
    );
    return rowCount === 1;
  }

  // ---------- public reads: published events only, through the events_public policy ----------

  async findPublished(tx: pg.PoolClient, slug: string): Promise<EventRow | null> {
    const { rows } = await tx.query<EventRow>(
      `select ${EVENT_COLUMNS} from catalogue.events where slug = $1 and status = 'published'`,
      [slug],
    );
    return rows[0] ?? null;
  }

  async organiserName(tx: pg.PoolClient, organisationId: string): Promise<string | null> {
    const { rows } = await tx.query<{ name: string | null }>(
      'select catalogue.organiser_name($1) as name',
      [organisationId],
    );
    return rows[0]?.name ?? null;
  }

  /**
   * Upcoming published events in a city (online events show in every city), soonest first.
   * "Tonight", "this weekend" and "next 7 days" are worked out in the city's time zone.
   */
  async browse(
    tx: pg.PoolClient,
    query: {
      city: string;
      timeZone: string;
      when?: 'tonight' | 'this_weekend' | 'next_7_days';
      price?: 'free' | 'paid';
      after?: { startsAt: string; id: string };
      limit: number;
    },
  ): Promise<BrowseRow[]> {
    const { rows } = await tx.query<BrowseRow>(
      `with bounds as (
         select now() as now_at,
                (now() at time zone $2)::date as today,
                extract(isodow from now() at time zone $2)::int as dow
       ),
       window_ as (
         select now_at as from_at,
           case $3::text
             when 'tonight' then ((today + 1)::timestamp at time zone $2)
             when 'this_weekend' then ((today + (8 - dow))::timestamp at time zone $2)
             when 'next_7_days' then now_at + interval '7 days'
           end as to_at,
           case $3::text
             when 'this_weekend' then greatest(now_at,
               ((today + greatest(0, 6 - dow))::timestamp at time zone $2))
             else now_at
           end as weekend_from
         from bounds
       ),
       priced as (
         select ${EVENT_COLUMNS.split(',')
           .map((c) => `e.${c.trim()}`)
           .join(', ')},
                coalesce((select min(t.price_cents) from catalogue.ticket_types t
                          where t.event_id = e.id), 0) as price_from_cents
         from catalogue.events e
         where e.status = 'published' and (e.city = $1 or e.city is null)
       )
       select p.* from priced p, window_ w
       where p.ends_at > w.from_at
         and ($3::text is null or (p.starts_at < w.to_at and p.ends_at > w.weekend_from))
         and ($4::text is null
              or ($4 = 'free' and p.price_from_cents = 0)
              or ($4 = 'paid' and p.price_from_cents > 0))
         and ($5::timestamptz is null or (p.starts_at, p.id) > ($5::timestamptz, $6::uuid))
       order by p.starts_at, p.id
       limit $7`,
      [
        query.city,
        query.timeZone,
        query.when ?? null,
        query.price ?? null,
        query.after?.startsAt ?? null,
        query.after?.id ?? null,
        query.limit,
      ],
    );
    return rows;
  }
}
