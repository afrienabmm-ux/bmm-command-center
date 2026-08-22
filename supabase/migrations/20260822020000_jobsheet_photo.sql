-- Walk-in jobsheets: keep the original photo uploaded through Scan
-- Jobsheet, stored the same way as GenBlu screenshots and Restore Bike
-- photos (private bucket, path only in the DB; resolved to a signed URL
-- on read) — so a manager can look at the real thing whenever the
-- automated reading needs a human double-check.
alter table public.cc_repair_jobs
  add column if not exists jobsheet_photo_path text;

insert into storage.buckets (id, name, public)
values ('jobsheet-photos', 'jobsheet-photos', false)
on conflict (id) do nothing;
