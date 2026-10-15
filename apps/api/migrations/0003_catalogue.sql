-- Catalogue module (Sprint 1): events and their ticket types.
--
-- Organisers see and change only their own organisation's events (app.organisation_id). Anyone,
-- signed in or not, may read published events and their ticket types: that is the public event
-- page and browse. Drafts never leave their organisation.

create schema catalogue;
grant usage on schema catalogue to ot_app, ot_worker;

create type catalogue.event_status as enum ('draft', 'published');

create table catalogue.events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references identity.organisations (id) on delete restrict,
  status catalogue.event_status not null default 'draft',
  -- Bumped on every change to the event or its ticket types; autosave sends the version it saw.
  version integer not null default 0,
  template text not null
    check (template in ('workshop', 'gig', 'school_night', 'meetup', 'blank')),
  name text check (length(btrim(name)) between 1 and 120),
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text not null default 'Australia/Sydney' check (length(time_zone) <= 64),
  -- A place (with suburb, city and geo point) or an online link; shape checked by the api.
  venue jsonb,
  -- Copied from a place venue for browse; null for online events, which show in every city.
  city text check (city in ('sydney', 'melbourne')),
  -- Plain text only (SEC-3): the api strips markup and control characters before storing.
  about text not null default '' check (length(about) <= 2000),
  accessibility_features text[] not null default '{}',
  accessibility_notes text not null default '' check (length(accessibility_notes) <= 500),
  cancellation_policy text not null default 'any_time'
    check (cancellation_policy in ('any_time', 'up_to_24h', 'none')),
  -- Shown only to ticket holders, never on the public page.
  contact_email citext check (length(contact_email) <= 254),
  banner_key text,
  banner_width integer,
  banner_height integer,
  banner_focus_x real not null default 0.5 check (banner_focus_x between 0 and 1),
  banner_focus_y real not null default 0.5 check (banner_focus_y between 0 and 1),
  last_step text not null default 'basics'
    check (last_step in ('basics', 'tickets', 'details', 'review')),
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  published_at timestamptz,
  created_by uuid references identity.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (
    status = 'draft'
    or (slug is not null and published_at is not null and name is not null
        and starts_at is not null and ends_at is not null and venue is not null)
  )
);
create index events_organisation_idx on catalogue.events (organisation_id, updated_at desc);
create index events_published_starts_idx on catalogue.events (starts_at, id)
  where status = 'published';

create table catalogue.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  -- Repeated from the event so row-level security needs no join.
  organisation_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  capacity integer not null check (capacity between 1 and 100000),
  max_per_order integer not null check (max_per_order between 1 and 100 and max_per_order <= capacity),
  -- Whole cents. 0 while paid tickets are off.
  price_cents integer not null default 0 check (price_cents >= 0),
  sales_start jsonb not null,
  sales_end jsonb not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, organisation_id)
    references catalogue.events (id, organisation_id) on delete cascade
);
create index ticket_types_event_idx on catalogue.ticket_types (event_id, position);

alter table catalogue.events enable row level security;
alter table catalogue.events force row level security;
alter table catalogue.ticket_types enable row level security;
alter table catalogue.ticket_types force row level security;

create policy events_tenant on catalogue.events to ot_app
  using (organisation_id = identity.current_organisation_id())
  with check (organisation_id = identity.current_organisation_id());
create policy events_public on catalogue.events for select to ot_app
  using (status = 'published');
create policy events_worker on catalogue.events to ot_worker using (true) with check (true);

create policy ticket_types_tenant on catalogue.ticket_types to ot_app
  using (organisation_id = identity.current_organisation_id())
  with check (organisation_id = identity.current_organisation_id());
create policy ticket_types_public on catalogue.ticket_types for select to ot_app
  using (exists (
    select 1 from catalogue.events e
    where e.id = ticket_types.event_id and e.status = 'published'
  ));
create policy ticket_types_worker on catalogue.ticket_types to ot_worker
  using (true) with check (true);

-- The organiser's name for a public event page, without opening identity.organisations to the
-- public: only organisations with a published event, and only their name. The function runs as
-- ot_public_reader, a role nobody can log in as, which may read just enough for this.
do $$
begin
  if not exists (select from pg_roles where rolname = 'ot_public_reader') then
    create role ot_public_reader nologin;
  end if;
end
$$;
grant ot_public_reader to current_user;
grant usage on schema identity, catalogue to ot_public_reader;
grant select (id, name) on identity.organisations to ot_public_reader;
grant select (organisation_id, status) on catalogue.events to ot_public_reader;
create policy organisations_public_reader on identity.organisations for select
  to ot_public_reader using (true);
create policy events_public_reader on catalogue.events for select
  to ot_public_reader using (status = 'published');

create function catalogue.organiser_name(p_organisation_id uuid) returns text
  language sql stable security definer
  set search_path = catalogue, identity, pg_temp
  as $$
    select o.name from identity.organisations o
    where o.id = p_organisation_id
      and exists (
        select 1 from catalogue.events e
        where e.organisation_id = o.id and e.status = 'published'
      )
  $$;
alter function catalogue.organiser_name(uuid) owner to ot_public_reader;
revoke all on function catalogue.organiser_name(uuid) from public;
grant execute on function catalogue.organiser_name(uuid) to ot_app, ot_worker;
revoke ot_public_reader from current_user;

grant select, insert, update on catalogue.events to ot_app;
grant select, insert, update, delete on catalogue.ticket_types to ot_app;
grant select, insert, update on catalogue.events, catalogue.ticket_types to ot_worker;
