-- Reverted: the Customer Code report's click-to-fix box now updates
-- customer_code directly again instead of a separate report-only note, so
-- this column is no longer used.
alter table public.cc_repair_jobs
  drop column if exists customer_code_correction;
