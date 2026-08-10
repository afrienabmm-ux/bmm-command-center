alter table public.cc_repair_jobs
  add column if not exists pic_name text not null default '',
  add column if not exists model text not null default '',
  add column if not exists bike_year text not null default '',
  add column if not exists condition text not null default '',
  add column if not exists location text not null default '';
