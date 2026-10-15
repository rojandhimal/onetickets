-- Inventory (INV-1, ADR 0007): one row per ticket type holding its capacity, tickets sold and
-- tickets held. Postgres is the authority, and the CHECK below is what stops overselling: no
-- update, from any code path, can leave sold + held above capacity or either below zero.
--
-- Triggers on catalogue.ticket_types keep the two in step inside the same transaction: a ticket
-- type is created with its inventory row, a capacity change updates it (and fails if it would go
-- below what is sold or held), and a ticket type with tickets sold or held can't be deleted.

create schema inventory;
grant usage on schema inventory to ot_app, ot_worker;

create table inventory.ticket_inventory (
  ticket_type_id uuid primary key references catalogue.ticket_types (id) on delete cascade,
  -- Repeated from the ticket type so row-level security needs no join.
  organisation_id uuid not null,
  event_id uuid not null,
  capacity integer not null check (capacity >= 1),
  sold integer not null default 0,
  held integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint ticket_inventory_within_capacity
    check (sold >= 0 and held >= 0 and sold + held <= capacity)
);
create index ticket_inventory_event_idx on inventory.ticket_inventory (event_id);

alter table inventory.ticket_inventory enable row level security;
alter table inventory.ticket_inventory force row level security;

create policy ticket_inventory_tenant on inventory.ticket_inventory to ot_app
  using (organisation_id = identity.current_organisation_id())
  with check (organisation_id = identity.current_organisation_id());
-- Spots left on a public event page.
create policy ticket_inventory_public on inventory.ticket_inventory for select to ot_app
  using (exists (
    select 1 from catalogue.events e
    where e.id = ticket_inventory.event_id and e.status = 'published'
  ));
create policy ticket_inventory_worker on inventory.ticket_inventory to ot_worker
  using (true) with check (true);

-- No delete for either role: a row goes only with its ticket type.
grant select, insert, update (capacity, sold, held, updated_at)
  on inventory.ticket_inventory to ot_app;
grant select, update (sold, held, updated_at) on inventory.ticket_inventory to ot_worker;

-- The triggers run as the caller, so the same row-level security applies.
create function inventory.sync_ticket_type() returns trigger
  language plpgsql
  set search_path = inventory, pg_temp
  as $$
  begin
    if tg_op = 'INSERT' then
      insert into inventory.ticket_inventory (ticket_type_id, organisation_id, event_id, capacity)
      values (new.id, new.organisation_id, new.event_id, new.capacity);
      return new;
    elsif tg_op = 'UPDATE' then
      update inventory.ticket_inventory
         set capacity = new.capacity, updated_at = now()
       where ticket_type_id = new.id and capacity <> new.capacity;
      return new;
    else
      if exists (
        select 1 from inventory.ticket_inventory
         where ticket_type_id = old.id and sold + held > 0
      ) then
        raise exception 'ticket type % has tickets sold or held', old.id
          using errcode = 'restrict_violation';
      end if;
      return old;
    end if;
  end
  $$;
revoke all on function inventory.sync_ticket_type() from public;

create trigger ticket_types_inventory_insert after insert on catalogue.ticket_types
  for each row execute function inventory.sync_ticket_type();
create trigger ticket_types_inventory_capacity after update of capacity on catalogue.ticket_types
  for each row execute function inventory.sync_ticket_type();
create trigger ticket_types_inventory_delete before delete on catalogue.ticket_types
  for each row execute function inventory.sync_ticket_type();
