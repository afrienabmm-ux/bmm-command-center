-- The jobsheet's "User ID" field (who keyed in the job card at the counter).
alter table public.cc_repair_jobs
  add column if not exists jobsheet_user_id text not null default '';
