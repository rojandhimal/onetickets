-- Orders and tickets (S2-2, S2-3, ADR 0007): stores confirmed orders, issued tickets,
-- and enforces the INV-5 idempotency invariant with a unique index on idempotency_key.
--
-- Postgres is the authority for stock and money. Holds convert to sold stock atomically
-- via inventory.ticket_inventory during order creation.

create schema orders;
grant usage on schema orders to ot_app, ot_worker;

create table orders.orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null unique check (order_ref ~ '^OT-[A-Z0-9]{8}$'),
  organisation_id uuid not null references identity.organisations (id) on delete restrict,
  event_id uuid not null references catalogue.events (id) on delete restrict,
  hold_id uuid not null references inventory.holds (id) on delete restrict,
  idempotency_key uuid not null,
  attendee_name text not null check (length(btrim(attendee_name)) between 1 and 100),
  attendee_email text not null check (length(btrim(attendee_email)) between 3 and 255),
  opt_in_organiser boolean not null default false,
  total_price_cents integer not null default 0 check (total_price_cents >= 0),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- INV-5: unique idempotency_key index ensures identical submissions return the same order
-- without double holding or duplicate ticket creation.
create unique index orders_idempotency_key_idx on orders.orders (idempotency_key);
create index orders_event_id_idx on orders.orders (event_id);
create index orders_organisation_id_idx on orders.orders (organisation_id);
create index orders_attendee_email_idx on orders.orders (attendee_email);

create table orders.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders.orders (id) on delete cascade,
  ticket_ref text not null unique check (ticket_ref ~ '^T-[A-Z0-9]{8}$'),
  ticket_type_id uuid not null references catalogue.ticket_types (id) on delete restrict,
  organisation_id uuid not null references identity.organisations (id) on delete restrict,
  event_id uuid not null references catalogue.events (id) on delete restrict,
  attendee_name text not null check (length(btrim(attendee_name)) between 1 and 100),
  status text not null default 'valid' check (status in ('valid', 'attended', 'released')),
  created_at timestamptz not null default now()
);

create index tickets_order_id_idx on orders.tickets (order_id);
create index tickets_event_id_idx on orders.tickets (event_id);
create index tickets_ticket_type_id_idx on orders.tickets (ticket_type_id);

alter table orders.orders enable row level security;
alter table orders.orders force row level security;
alter table orders.tickets enable row level security;
alter table orders.tickets force row level security;

-- Tenant policy: organiser can view and manage their organisation's orders and tickets.
create policy orders_tenant on orders.orders to ot_app
  using (organisation_id = identity.current_organisation_id())
  with check (organisation_id = identity.current_organisation_id());

create policy tickets_tenant on orders.tickets to ot_app
  using (organisation_id = identity.current_organisation_id())
  with check (organisation_id = identity.current_organisation_id());

-- Public checkout insert policy: buyers can place orders for published events.
create policy orders_public_insert on orders.orders for insert to ot_app
  with check (
    exists (
      select 1 from catalogue.events e
      where e.id = orders.event_id and e.status = 'published'
    )
  );

create policy tickets_public_insert on orders.tickets for insert to ot_app
  with check (
    exists (
      select 1 from catalogue.events e
      where e.id = tickets.event_id and e.status = 'published'
    )
  );

-- Public order lookup policy: confirmation page and ticket lookups.
create policy orders_public_select on orders.orders for select to ot_app
  using (
    exists (
      select 1 from catalogue.events e
      where e.id = orders.event_id and e.status = 'published'
    )
  );

create policy tickets_public_select on orders.tickets for select to ot_app
  using (
    exists (
      select 1 from catalogue.events e
      where e.id = tickets.event_id and e.status = 'published'
    )
  );

-- Worker policy: background processors, ticket release sweepers, notifications.
create policy orders_worker on orders.orders to ot_worker
  using (true) with check (true);

create policy tickets_worker on orders.tickets to ot_worker
  using (true) with check (true);

grant select, insert, update (status) on orders.orders to ot_app;
grant select, insert, update (status) on orders.tickets to ot_app;
grant select, update on orders.orders, orders.tickets to ot_worker;
