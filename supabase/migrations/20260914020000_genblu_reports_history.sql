-- Was "one row per month, always overwritten" — Jason wants to see how
-- the numbers moved week to week within a month, which needs every
-- snapshot the Sales Dashboard sends kept (each dated), not just the
-- latest. Re-created rather than altered in place since the old table
-- only ever held throwaway test rows (nothing real to migrate forward).
drop table if exists cc_genblu_reports;

create table cc_genblu_reports (
  id uuid primary key default gen_random_uuid(),
  month text not null, -- "YYYY-MM", from X-Report-Month
  report jsonb not null,
  received_at timestamptz not null default now()
);

create index cc_genblu_reports_month_idx on cc_genblu_reports (month, received_at);
