-- Set once a suspicious Walk-in job (see getSuspiciousWalkInJobs) has been
-- opened and confirmed fine from the Dashboard's "worth a second look"
-- banner — keeps it from being flagged again on every future visit.
alter table public.cc_repair_jobs add column if not exists suspicious_dismissed_at timestamptz;
