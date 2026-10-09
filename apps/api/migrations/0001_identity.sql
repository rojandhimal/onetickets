-- Identity module: users, organisations and memberships, fenced by row-level security.
--
-- Roles (created here, granted to login users by infra):
--   ot_app     the api. Sees one organisation per transaction, set with
--              set_config('app.organisation_id', ..., true), plus the signed-in user's own rows.
--   ot_worker  background jobs that act across organisations.
-- Tables are owned by the migration role and use FORCE ROW LEVEL SECURITY, so even the owner
-- is fenced. Superusers still bypass RLS, which is why the api must never connect as one.

create extension if not exists citext;

do $$
begin
  if not exists (select from pg_roles where rolname = 'ot_app') then
    create role ot_app nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'ot_worker') then
    create role ot_worker nologin;
  end if;
end
$$;

create schema identity;
grant usage on schema identity to ot_app, ot_worker;

-- Tenant context helpers. Empty or unset settings read as null, which matches nothing.
create function identity.current_organisation_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.organisation_id', true), '')::uuid $$;

create function identity.current_user_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create type identity.role as enum ('owner', 'admin', 'finance', 'door_staff');

create table identity.users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique check (length(email) <= 254),
  mfa_enabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table identity.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table identity.memberships (
  organisation_id uuid not null references identity.organisations (id) on delete cascade,
  user_id uuid not null references identity.users (id) on delete cascade,
  role identity.role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);
create index memberships_user_id_idx on identity.memberships (user_id);

-- Who changed what in an organisation. Insert-only for every role, and it outlives nothing:
-- an organisation with audit events cannot be deleted by accident.
create table identity.audit_events (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references identity.organisations (id) on delete restrict,
  actor_user_id uuid references identity.users (id) on delete set null,
  action text not null,
  subject_user_id uuid references identity.users (id) on delete set null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_events_organisation_idx on identity.audit_events (organisation_id, created_at);

alter table identity.audit_events enable row level security;
alter table identity.audit_events force row level security;
create policy audit_events_tenant on identity.audit_events to ot_app
  using (organisation_id = identity.current_organisation_id())
  with check (organisation_id = identity.current_organisation_id());
create policy audit_events_worker on identity.audit_events to ot_worker using (true) with check (true);

alter table identity.users enable row level security;
alter table identity.users force row level security;
alter table identity.organisations enable row level security;
alter table identity.organisations force row level security;
alter table identity.memberships enable row level security;
alter table identity.memberships force row level security;

-- Memberships: the current organisation's rows, plus the signed-in user's own memberships
-- elsewhere (so they can pick an organisation). Writes only inside the current organisation.
create policy memberships_tenant on identity.memberships to ot_app
  using (organisation_id = identity.current_organisation_id())
  with check (organisation_id = identity.current_organisation_id());
create policy memberships_own on identity.memberships for select to ot_app
  using (user_id = identity.current_user_id());

-- Organisations: the current one, plus any the signed-in user belongs to (read only).
create policy organisations_tenant on identity.organisations to ot_app
  using (id = identity.current_organisation_id())
  with check (id = identity.current_organisation_id());
create policy organisations_member on identity.organisations for select to ot_app
  using (exists (
    select 1 from identity.memberships m
    where m.organisation_id = organisations.id and m.user_id = identity.current_user_id()
  ));

-- Users belong to no organisation: visible to themselves and to the current organisation if
-- they are a member of it. New users come from sign-up or ensure_user(); only self-updates.
create policy users_visible on identity.users for select to ot_app
  using (
    id = identity.current_user_id()
    or exists (
      select 1 from identity.memberships m
      where m.user_id = users.id and m.organisation_id = identity.current_organisation_id()
    )
  );
create policy users_insert on identity.users for insert to ot_app with check (true);
create policy users_update_self on identity.users for update to ot_app
  using (id = identity.current_user_id())
  with check (id = identity.current_user_id());

-- Workers act across organisations through their own role, not a bypass flag on ot_app.
create policy users_worker on identity.users to ot_worker using (true) with check (true);
create policy organisations_worker on identity.organisations to ot_worker using (true) with check (true);
create policy memberships_worker on identity.memberships to ot_worker using (true) with check (true);

-- ensure_user() runs as the table owner, which FORCE subjects to RLS too, so the owner gets
-- its own policy on users only.
create policy users_owner on identity.users to current_user using (true) with check (true);

-- Find or create a user by email and return only the id, so inviting someone who already has
-- an account does not need read access to users outside the organisation.
create function identity.ensure_user(p_email citext) returns uuid
  language plpgsql security definer
  set search_path = identity, pg_temp
  as $$
declare
  v_id uuid;
begin
  insert into identity.users (email) values (p_email)
    on conflict (email) do nothing
    returning id into v_id;
  if v_id is null then
    select id into v_id from identity.users where email = p_email;
  end if;
  return v_id;
end
$$;
revoke all on function identity.ensure_user(citext) from public;

grant execute on function identity.current_organisation_id(), identity.current_user_id() to ot_app, ot_worker;
grant execute on function identity.ensure_user(citext) to ot_app, ot_worker;
grant select, insert, update on identity.users to ot_app;
-- No delete grants until a feature needs one (least privilege).
grant select, insert, update on identity.organisations, identity.memberships to ot_app;
grant select, insert on identity.audit_events to ot_app, ot_worker;
grant select, insert, update on identity.users, identity.organisations, identity.memberships
  to ot_worker;
