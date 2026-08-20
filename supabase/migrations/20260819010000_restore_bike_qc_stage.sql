-- Restore Bike jobs get a QC stage between the mechanic's repair and
-- Completed: finishing the repair (End Date) now lands the job in "QC"
-- instead of "Completed" directly, and the branch PIC has to pass it
-- before it's truly done.
alter table public.cc_repair_jobs
  add column if not exists qc_result text,
  add column if not exists qc_date date;

alter table public.cc_repair_jobs drop constraint if exists cc_repair_jobs_status_check;
alter table public.cc_repair_jobs
  add constraint cc_repair_jobs_status_check
  check (status in ('Pending', 'In Progress', 'QC', 'Completed'));

alter table public.cc_repair_jobs drop constraint if exists cc_repair_jobs_qc_result_check;
alter table public.cc_repair_jobs
  add constraint cc_repair_jobs_qc_result_check
  check (qc_result is null or qc_result in ('Passed', 'Failed'));
