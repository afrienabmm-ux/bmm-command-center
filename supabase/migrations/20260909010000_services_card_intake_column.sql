-- Same idempotency need as the GenBlu intake endpoint (see
-- 20260909000000_genblu_intake_columns.sql) — a card forwarded from the
-- Sales Dashboard's own "sold" action carries their own id, stored here so
-- a retried delivery can be recognized and skipped instead of issuing a
-- second card for the same sale.
alter table public.cc_customer_cards
  add column if not exists external_source_id text;

create unique index if not exists cc_customer_cards_external_source_id_idx
  on public.cc_customer_cards (external_source_id)
  where external_source_id is not null;
