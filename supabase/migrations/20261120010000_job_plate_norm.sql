-- 2026-11-20: plate without spaces/dashes, in capitals, stored with the job and indexed, so the
-- customer app can look up one bike's job sheets directly instead of reading every job sheet.
-- Same rule as lib/plate.ts normalizePlate.
alter table cc_repair_jobs add column if not exists plate_norm text
  generated always as (upper(regexp_replace(coalesce(plate_no, ''), '[\s-]', '', 'g'))) stored;
create index if not exists cc_repair_jobs_plate_norm_idx on cc_repair_jobs (plate_norm);
