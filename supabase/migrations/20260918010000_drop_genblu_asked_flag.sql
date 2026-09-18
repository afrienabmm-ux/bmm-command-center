-- Reverted: the GenBlu column on the Jobsheet is now a plain yes/no based
-- on an actual registration (see hasGenblu), not a manual "asked" stamp.
alter table public.cc_repair_jobs
  drop column if exists genblu_asked;
