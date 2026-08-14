-- Extra fields from the paper jobsheet that Walk-in jobs need a home for,
-- so a scanned jobsheet has a matching box for every field it reads.
alter table public.cc_repair_jobs
  add column if not exists customer_code text not null default '';
alter table public.cc_repair_jobs
  add column if not exists colour text not null default '';
alter table public.cc_repair_jobs
  add column if not exists engine_no text not null default '';
alter table public.cc_repair_jobs
  add column if not exists chassis_no text not null default '';
