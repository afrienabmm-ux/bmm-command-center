-- QC failing a Restore Bike job now records why, instead of silently
-- clearing the result — the PIC must state the reason it failed.
alter table public.cc_repair_jobs add column if not exists qc_fail_reason text;
