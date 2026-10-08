-- S0-3 sign-in: magic links, sessions and rate limits. None of these belong to an organisation.
-- Rows are addressed only by the SHA-256 of a secret the client holds, so ot_app may reach any
-- row; the secret itself is never stored.

alter table identity.users add column name text check (length(name) <= 200);

create table identity.magic_links (
  token_hash bytea primary key,
  email citext not null,
  -- Used only if the email is new: becomes the first organisation's name.
  organiser_name text check (length(btrim(organiser_name)) between 1 and 120),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index magic_links_email_idx on identity.magic_links (email) where used_at is null;

create table identity.sessions (
  token_hash bytea primary key,
  user_id uuid not null references identity.users (id) on delete cascade,
  mfa_verified_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Absolute limit; the idle limit is checked against last_seen_at.
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index sessions_user_id_idx on identity.sessions (user_id);

-- Fixed-window counters for sign-in rate limits.
create table identity.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null,
  primary key (key, window_start)
);

alter table identity.magic_links enable row level security;
alter table identity.magic_links force row level security;
alter table identity.sessions enable row level security;
alter table identity.sessions force row level security;
alter table identity.rate_limits enable row level security;
alter table identity.rate_limits force row level security;

create policy magic_links_app on identity.magic_links to ot_app using (true) with check (true);
create policy sessions_app on identity.sessions to ot_app using (true) with check (true);
create policy rate_limits_app on identity.rate_limits to ot_app using (true) with check (true);
create policy magic_links_worker on identity.magic_links to ot_worker using (true) with check (true);
create policy sessions_worker on identity.sessions to ot_worker using (true) with check (true);
create policy rate_limits_worker on identity.rate_limits to ot_worker using (true) with check (true);

grant select, insert, update on identity.magic_links, identity.sessions to ot_app;
grant select, insert, update, delete on identity.rate_limits to ot_app;
grant select, insert, update, delete on identity.magic_links, identity.sessions, identity.rate_limits to ot_worker;

-- Authenticator-app MFA (TOTP). The secret is encrypted by the api (AES-256-GCM, key from
-- MFA_ENCRYPTION_KEY); the database never sees it in the clear.
alter table identity.users
  add column totp_secret_enc bytea,
  -- Last accepted 30-second step, so a code cannot be replayed within its window.
  add column totp_last_step bigint;

create table identity.mfa_recovery_codes (
  user_id uuid not null references identity.users (id) on delete cascade,
  code_hash bytea not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, code_hash)
);
alter table identity.mfa_recovery_codes enable row level security;
alter table identity.mfa_recovery_codes force row level security;
create policy mfa_recovery_codes_self on identity.mfa_recovery_codes to ot_app
  using (user_id = identity.current_user_id())
  with check (user_id = identity.current_user_id());
create policy mfa_recovery_codes_worker on identity.mfa_recovery_codes to ot_worker
  using (true) with check (true);
grant select, insert, update, delete on identity.mfa_recovery_codes to ot_app, ot_worker;
