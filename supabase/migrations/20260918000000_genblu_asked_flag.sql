-- A manual "asked the customer to install GenBlu" stamp on the Walk-in
-- jobsheet, separate from actually having a GenBlu registration on file
-- (cc_genblu_registrations, matched by plate number) — staff can mark a
-- customer as asked even before/without a registration ever coming in.
alter table public.cc_repair_jobs
  add column if not exists genblu_asked boolean not null default false;
