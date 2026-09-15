-- The Customer Code report's click-to-fill-in box saves here, not onto
-- customer_code itself — a report-only note of what the real IC should be
-- for follow-up, deliberately kept separate so filling it in never
-- silently rewrites the actual jobsheet record.
alter table public.cc_repair_jobs
  add column if not exists customer_code_correction text;
