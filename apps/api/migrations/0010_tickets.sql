-- Tickets (S2-3, ADR 0011): one row per ticket a buyer holds. The QR token is rebuilt from the
-- row (version, key id, event id, ticket id, issued-at) plus the stored Ed25519 signature, so the
-- row holds no personal data and nothing secret beyond what the QR already shows.
--
-- Tickets are issued unsigned inside the order's transaction and signed afterwards: in AWS only a
-- signing worker may use the key (threat model section 4). A signature, once set, never changes.

create schema ticketing;
grant usage on schema ticketing to ot_app, ot_worker;

create table ticketing.tickets (
  -- Random (gen_random_uuid is v4): the id in the QR, so it must not be guessable (T15).
  id uuid primary key default gen_random_uuid(),
  -- Short code on the stub for door staff to look up by hand. Unique within the event.
  ref text not null check (ref ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  organisation_id uuid not null,
  event_id uuid not null references catalogue.events (id),
  ticket_type_id uuid not null references catalogue.ticket_types (id),
  order_id uuid not null references checkout.orders (id),
  -- Whole seconds, because the token carries seconds.
  issued_at timestamptz not null default date_trunc('second', now())
    check (issued_at = date_trunc('second', issued_at)),
  key_id text check (key_id ~ '^[0-9a-f]{16}$'),
  signature bytea check (octet_length(signature) = 64),
  signed_at timestamptz,
  revoked_at timestamptz,
  constraint tickets_ref_unique unique (event_id, ref),
  constraint tickets_signed_together check (
    (key_id is null and signature is null and signed_at is null)
    or (key_id is not null and signature is not null and signed_at is not null)
  )
);
create index tickets_order_idx on ticketing.tickets (order_id);
create index tickets_event_idx on ticketing.tickets (event_id);
create index tickets_unsigned_idx on ticketing.tickets (issued_at) where signature is null;

alter table ticketing.tickets enable row level security;
alter table ticketing.tickets force row level security;

-- Organisers read their own organisation's tickets (attendee lists, check-in later).
create policy tickets_tenant on ticketing.tickets for select to ot_app
  using (organisation_id = identity.current_organisation_id());

-- A buyer's request reads and signs only the tickets of the order it proved access to.
create policy tickets_order on ticketing.tickets for select to ot_app
  using (order_id = checkout.current_order_id());
create policy tickets_order_sign on ticketing.tickets for update to ot_app
  using (order_id = checkout.current_order_id())
  with check (order_id = checkout.current_order_id());

-- Issuing happens in the order's transaction: only for the order in scope and its event, for a
-- published event, under the event's own organisation and ticket type.
create policy tickets_issue on ticketing.tickets for insert to ot_app
  with check (
    order_id = checkout.current_order_id()
    and exists (
      select 1 from checkout.orders o
      where o.id = tickets.order_id and o.event_id = tickets.event_id
    )
    and exists (
      select 1 from catalogue.ticket_types t
      join catalogue.events e on e.id = t.event_id
      where t.id = tickets.ticket_type_id
        and e.id = tickets.event_id
        and e.organisation_id = tickets.organisation_id
        and e.status = 'published'
    )
  );

-- The signing worker signs across all organisations.
create policy tickets_worker on ticketing.tickets to ot_worker
  using (true) with check (true);

-- No delete for anyone: a ticket is revoked, never removed.
grant select, insert (ref, organisation_id, event_id, ticket_type_id, order_id)
  on ticketing.tickets to ot_app;
grant update (key_id, signature, signed_at) on ticketing.tickets to ot_app;
grant select, update (key_id, signature, signed_at) on ticketing.tickets to ot_worker;

-- A ticket is signed once: the signature can be set but never changed or cleared, and the signed
-- fields are only ever written together.
create function ticketing.sign_once() returns trigger
  language plpgsql
  set search_path = ticketing, pg_temp
  as $$
  begin
    if old.signature is not null and (
      new.signature is distinct from old.signature
      or new.key_id is distinct from old.key_id
      or new.signed_at is distinct from old.signed_at
    ) then
      raise exception 'ticket % is already signed', old.id using errcode = 'check_violation';
    end if;
    return new;
  end;
  $$;

create trigger tickets_sign_once before update on ticketing.tickets
  for each row execute function ticketing.sign_once();
