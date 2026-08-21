-- Walk-in jobsheets didn't capture a customer phone number, so visit
-- matching for memberships (stamps, tier, points) relied on name alone,
-- which breaks on typos/variants. Adding phone lets matching use either.
alter table public.cc_repair_jobs
  add column if not exists customer_phone text not null default '';
