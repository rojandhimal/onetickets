-- The "from" price rule, in one place that browse's filter, browse cards and the event page all
-- read (QA 5.6): the cheapest base price among the ticket types on sale at `at`, or among all of
-- them when none is, or 0 with none. Fees are added on top by the api (pricing.ts), which only
-- ever raises a price above 0, so free stays free.
--
-- On sale mirrors the api's sales-window.ts: the event is published, the sales start ("when I
-- publish" or a date) has passed and the sales end (relative to the event, or a date) has not.
-- Both run as the caller, so row-level security applies as usual.

create function catalogue.ticket_on_sale(
  t catalogue.ticket_types, e catalogue.events, at timestamptz
) returns boolean
  language sql stable
  set search_path = catalogue, pg_temp
  as $$
    select e.published_at is not null
      and coalesce(
        case t.sales_start ->> 'kind'
          when 'at' then (t.sales_start ->> 'at')::timestamptz
          else e.published_at
        end <= at, false)
      and coalesce(
        at < case t.sales_end ->> 'kind'
          when 'at' then (t.sales_end ->> 'at')::timestamptz
          when 'event_end' then e.ends_at
          when 'event_start' then e.starts_at
          when 'hour_before' then e.starts_at - interval '1 hour'
          when 'day_before' then e.starts_at - interval '1 day'
        end, false)
  $$;

create function catalogue.from_price_cents(p_event_id uuid, at timestamptz) returns integer
  language sql stable
  set search_path = catalogue, pg_temp
  as $$
    select coalesce(
      (select min(t.price_cents)
         from catalogue.ticket_types t join catalogue.events e on e.id = t.event_id
        where t.event_id = p_event_id and catalogue.ticket_on_sale(t, e, at)),
      (select min(t.price_cents) from catalogue.ticket_types t where t.event_id = p_event_id),
      0)
  $$;

revoke all on function catalogue.ticket_on_sale(catalogue.ticket_types, catalogue.events, timestamptz),
  catalogue.from_price_cents(uuid, timestamptz) from public;
grant execute on function
  catalogue.ticket_on_sale(catalogue.ticket_types, catalogue.events, timestamptz),
  catalogue.from_price_cents(uuid, timestamptz) to ot_app, ot_worker;
