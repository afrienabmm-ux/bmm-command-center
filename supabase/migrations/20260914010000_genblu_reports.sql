-- Replaces the earlier cc_bike_sales approach (this session, same day) —
-- the Sales Dashboard confirmed it will send one already-computed report
-- per month instead, via app/api/genblu-report-intake, so there's no need
-- to store raw per-sale rows and compute the percentages ourselves.
drop table if exists cc_bike_sales;

-- One row per calendar month, always overwritten in place ("keep only the
-- latest report for each month" per the Sales Dashboard's own spec) — the
-- full JSON payload is kept as-is (targets, total, branches, salespeople)
-- rather than normalized into columns, since the exact shape is theirs to
-- define and may grow fields over time without needing a migration here.
create table if not exists cc_genblu_reports (
  month text primary key, -- "YYYY-MM"
  report jsonb not null,
  received_at timestamptz not null default now()
);
