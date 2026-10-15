-- A ticket costs at most A$10,000 (EVENT_LIMITS.priceCents in packages/shared). The api refuses
-- more with 422; this keeps the database to the same rule, so nothing above it can be stored.
alter table catalogue.ticket_types
  add constraint ticket_types_price_limit check (price_cents <= 1000000);
