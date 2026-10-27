-- SEC-4: attendee credentials never become organiser identities or order write scope.
-- As with organiser sessions, the app resolves these auth rows by a secret's SHA-256 hash.
create table identity.attendee_links (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  email citext not null check (length(email) between 3 and 254),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index attendee_links_email_idx on identity.attendee_links (email) where used_at is null;
create table identity.attendee_sessions (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  email citext not null check (length(email) between 3 and 254),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table identity.attendee_links enable row level security;
alter table identity.attendee_links force row level security;
alter table identity.attendee_sessions enable row level security;
alter table identity.attendee_sessions force row level security;
create policy attendee_links_app on identity.attendee_links to ot_app using (true) with check (true);
create policy attendee_sessions_app on identity.attendee_sessions to ot_app using (true) with check (true);
grant select, insert, update (used_at) on identity.attendee_links to ot_app;
grant select, insert, update (last_seen_at, revoked_at) on identity.attendee_sessions to ot_app;
-- SEC-9 retention worker can remove spent credentials; no app DELETE permission.
create policy attendee_links_worker on identity.attendee_links to ot_worker using (true) with check (true);
create policy attendee_sessions_worker on identity.attendee_sessions to ot_worker using (true) with check (true);
grant select, delete on identity.attendee_links, identity.attendee_sessions to ot_worker;

create function identity.current_attendee_email() returns citext
  language sql stable
  as $$ select nullif(current_setting('app.attendee_email', true), '')::citext $$;
revoke all on function identity.current_attendee_email() from public;
grant execute on function identity.current_attendee_email() to ot_app;
create index orders_buyer_email_id_idx on checkout.orders (buyer_email, id);
-- Deliberately SELECT only. app.order_id also authorises issuing/signing and is never set here.
create policy orders_attendee on checkout.orders for select to ot_app
  using (buyer_email = identity.current_attendee_email());
create policy tickets_attendee on ticketing.tickets for select to ot_app
  using (exists (
    select 1 from checkout.orders o
    where o.id = tickets.order_id and o.buyer_email = identity.current_attendee_email()
  ));
