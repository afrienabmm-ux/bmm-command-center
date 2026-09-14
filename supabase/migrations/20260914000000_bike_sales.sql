-- One row per bike sold, forwarded from the separate Sales Dashboard the
-- same way GenBlu registrations already are (see app/api/bike-sales-intake
-- and cc_genblu_registrations.external_source_id for the matching
-- pattern). This is the denominator for the GenBlu registration-rate
-- report: what fraction of bikes sold by a salesperson turned into a
-- GenBlu registration, by person and by branch.
create table if not exists cc_bike_sales (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  salesperson_name text not null,
  sale_date date not null,
  -- The Sales Dashboard's own id for this sale — same idempotency role as
  -- cc_genblu_registrations.external_source_id, so a retried delivery
  -- never counts the same bike twice.
  external_sale_id text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists cc_bike_sales_branch_date_idx
  on cc_bike_sales (branch, sale_date);

create index if not exists cc_bike_sales_salesperson_idx
  on cc_bike_sales (salesperson_name);
