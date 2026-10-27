-- Delivery receipt only: no buyer details, message body or plaintext ticket key.
-- No backfill: historic orders are not emailed without a new checkout retry.
create table checkout.order_confirmations (
  order_id uuid primary key references checkout.orders (id),
  sent_at timestamptz
);
alter table checkout.order_confirmations enable row level security;
alter table checkout.order_confirmations force row level security;
create policy confirmations_order on checkout.order_confirmations to ot_app
  using (order_id = checkout.current_order_id())
  with check (order_id = checkout.current_order_id());
grant select, insert, update (sent_at) on checkout.order_confirmations to ot_app;
