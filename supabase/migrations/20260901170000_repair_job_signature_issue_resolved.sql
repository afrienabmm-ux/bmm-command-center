-- Jobsheets where the scan found no signature (signature_status =
-- 'not_detected') but were saved anyway go to an "Errors" tab until
-- Management checks the actual photo and confirms/clears it here.
alter table public.cc_repair_jobs add column if not exists signature_issue_resolved boolean not null default false;
