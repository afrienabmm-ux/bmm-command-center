-- Distinguishes a GenBlu registration made for a customer who already had a
-- jobsheet on file at the time ("has_jobsheet") from one made for a brand
-- new customer with no jobsheet yet ("new_customer") — needed to split the
-- GenBlu Tracker report into two separate report types. Existing rows are
-- backfilled with a best-effort guess: a registration whose plate number
-- matches an existing repair job in the same branch is treated as
-- "has_jobsheet", everything else as "new_customer".
alter table public.cc_genblu_registrations
  add column if not exists source text not null default 'new_customer' check (source in ('new_customer', 'has_jobsheet'));

update public.cc_genblu_registrations r
set source = 'has_jobsheet'
where r.customer_plate_no <> ''
  and exists (
    select 1 from public.cc_repair_jobs j
    where j.branch = r.branch
      and lower(trim(j.plate_no)) = lower(trim(r.customer_plate_no))
  );
