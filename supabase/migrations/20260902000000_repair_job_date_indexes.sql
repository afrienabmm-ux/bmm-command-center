-- Almost every dashboard/report query filters cc_repair_jobs by
-- status + completed_date (revenue "achieved" figures) or
-- job_type + started_date (mechanic daily pace), but only single-column
-- indexes existed (branch, status, mechanic_id) — every one of those
-- queries was falling back to a slow scan-and-filter on date range.
create index if not exists cc_repair_jobs_status_completed_date_idx
  on public.cc_repair_jobs (status, completed_date);

create index if not exists cc_repair_jobs_job_type_started_date_idx
  on public.cc_repair_jobs (job_type, started_date);
