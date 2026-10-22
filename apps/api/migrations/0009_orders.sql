-- Orders (S2-2): a buyer's free checkout turns their holds into one order. The order holds the
-- buyer's name and email, so only that order's own link and its organiser can read it.
--
-- A buyer has no account. They prove access to an order with a random key (256 bits) that the
-- api returns once and keeps only as a SHA-256 hash, the same way sessions and holds are stored.

create schema checkout;
grant usage on schema checkout to ot_app, ot_worker;

-- The order a buyer's request has proved access to (by its key), like app.organisation_id for
-- organisers. Unset means none.
create function checkout.current_order_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.order_id', true), '')::uuid $$;
grant execute on function checkout.current_order_id() to ot_app, ot_worker;

create table checkout.orders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  event_id uuid not null references catalogue.events (id),
  buyer_name text not null check (length(buyer_name) between 1 and 100),
  buyer_email citext not null check (length(buyer_email) <= 254),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);
create index orders_event_idx on checkout.orders (event_id);

-- One row per checkout attempt's idempotency key (INV-5). A retry with the same key gets the
-- same order back, but only when it presents the same holds: holds_digest is the SHA-256 of the
-- holds' token hashes, so knowing the key alone is not enough. No personal data here.
create table checkout.order_requests (
  idempotency_key uuid primary key,
  order_id uuid not null unique
    references checkout.orders (id) deferrable initially deferred,
  holds_digest bytea not null check (octet_length(holds_digest) = 32),
  created_at timestamptz not null default now()
);

-- Keys to an order's tickets: the one checkout returns, one per retry, and later ones emailed
-- from My tickets (S2-4). Looked up by hash only.
create table checkout.order_keys (
  key_hash bytea primary key check (octet_length(key_hash) = 32),
  order_id uuid not null references checkout.orders (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index order_keys_order_idx on checkout.order_keys (order_id);

alter table checkout.orders enable row level security;
alter table checkout.orders force row level security;
alter table checkout.order_requests enable row level security;
alter table checkout.order_requests force row level security;
alter table checkout.order_keys enable row level security;
alter table checkout.order_keys force row level security;

-- Organisers read their own organisation's orders (attendee lists later).
create policy orders_tenant on checkout.orders for select to ot_app
  using (organisation_id = identity.current_organisation_id());
-- A buyer's request reads only the order it proved access to.
create policy orders_buyer on checkout.orders for select to ot_app
  using (id = checkout.current_order_id());
-- Checkout creates the order in scope, for a published event under the event's own organisation.
create policy orders_create on checkout.orders for insert to ot_app
  with check (
    id = checkout.current_order_id()
    and exists (
      select 1 from catalogue.events e
      where e.id = orders.event_id
        and e.organisation_id = orders.organisation_id
        and e.status = 'published'
    )
  );

-- Addressed by a client key or a secret's hash, like identity.sessions: the api finds the row
-- first and only then knows which order is in scope.
create policy order_requests_app on checkout.order_requests to ot_app
  using (true) with check (true);
create policy order_keys_app on checkout.order_keys to ot_app using (true) with check (true);

-- Orders are never edited or deleted by the api; keys expire rather than being removed.
grant select, insert on checkout.orders to ot_app;
grant select, insert on checkout.order_requests to ot_app;
grant select, insert on checkout.order_keys to ot_app;
