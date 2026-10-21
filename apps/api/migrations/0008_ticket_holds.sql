-- Ticket holds (S2-1, ADR 0007): tracks short-lived reservations during checkout.
-- Holds decrement available inventory atomically (INV-1, INV-2) without holding locks across
-- network calls. A background sweeper returns expired holds exactly once (INV-3).
--
-- Rows are addressed by the SHA-256 of an opaque client token, so ot_app may create and update
-- holds for published events without exposing the raw secret in Postgres.

create table inventory.holds (
  id uuid primary key default gen_random_uuid(),
  ticket_type_id uuid not null references catalogue.ticket_types (id) on delete cascade,
  organisation_id uuid not null,
  event_id uuid not null,
  quantity integer not null check (quantity >= 1),
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  converted_at timestamptz,
  constraint hold_state_exclusive check (
    not (released_at is not null and converted_at is not null)
  )
);

create index holds_token_hash_idx on inventory.holds (token_hash)
  where released_at is null and converted_at is null;
create index holds_expired_idx on inventory.holds (expires_at)
  where released_at is null and converted_at is null;
create index holds_ticket_type_idx on inventory.holds (ticket_type_id);
create index holds_event_idx on inventory.holds (event_id);

alter table inventory.holds enable row level security;
alter table inventory.holds force row level security;

-- Tenant policy: organiser can inspect holds belonging to their organisation.
create policy holds_tenant on inventory.holds to ot_app
  using (organisation_id = identity.current_organisation_id())
  with check (organisation_id = identity.current_organisation_id());

-- Public checkout policy: buyers can create, inspect, and update holds on published events.
create policy holds_public on inventory.holds to ot_app
  using (
    exists (
      select 1 from catalogue.events e
      where e.id = holds.event_id and e.status = 'published'
    )
  )
  with check (
    exists (
      select 1 from catalogue.events e
      where e.id = holds.event_id and e.status = 'published'
    )
  );

-- Background sweeper: ot_worker sweeps expired holds across all organisations.
create policy holds_worker on inventory.holds to ot_worker
  using (true) with check (true);

grant select, insert, update (expires_at, released_at, converted_at)
  on inventory.holds to ot_app;
grant select, update (released_at)
  on inventory.holds to ot_worker;

-- Policy on ticket_inventory allowing ot_app to update held counts for published events during checkout.
create policy ticket_inventory_public_hold on inventory.ticket_inventory for update to ot_app
  using (
    exists (
      select 1 from catalogue.events e
      where e.id = ticket_inventory.event_id and e.status = 'published'
    )
  )
  with check (
    exists (
      select 1 from catalogue.events e
      where e.id = ticket_inventory.event_id and e.status = 'published'
    )
  );
