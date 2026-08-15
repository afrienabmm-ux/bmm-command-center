alter table public.cc_repair_job_items
  add column if not exists code text not null default '';
