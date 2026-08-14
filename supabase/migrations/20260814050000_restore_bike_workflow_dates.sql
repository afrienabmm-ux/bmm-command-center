-- Restore Bike workflow tracker: five click-to-stamp milestones, tracked
-- separately from the existing Started/End Date fields the PIC fills in on
-- the form (those cover the job's overall duration; these cover the
-- specific handoff points Jason wants visibility into).
alter table public.cc_repair_jobs
  add column if not exists arrived_date date;
alter table public.cc_repair_jobs
  add column if not exists quotation_date date;
alter table public.cc_repair_jobs
  add column if not exists gm_approved_date date;
alter table public.cc_repair_jobs
  add column if not exists repair_start_date date;
alter table public.cc_repair_jobs
  add column if not exists repair_end_date date;
