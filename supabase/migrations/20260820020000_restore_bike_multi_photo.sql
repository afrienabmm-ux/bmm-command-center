-- Restore Bike now allows up to 5 bike photos instead of just one.
alter table public.cc_repair_jobs add column if not exists image_paths text[] not null default '{}';

-- Backfill: fold any existing single image_path into the new array.
update public.cc_repair_jobs
set image_paths = array[image_path]
where image_path is not null and image_path <> '' and image_paths = '{}';
