-- Repair start/end are the job's existing started_date/completed_date
-- columns — no need for separate ones. Only Arrived/Quotation/GM Approved
-- are genuinely new milestones.
alter table public.cc_repair_jobs
  drop column if exists repair_start_date;
alter table public.cc_repair_jobs
  drop column if exists repair_end_date;
