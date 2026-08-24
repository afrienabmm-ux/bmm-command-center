-- The other half of QC-fail tracking: a reason alone doesn't guarantee
-- anyone actually looked into it. This date is stamped when the branch PIC
-- confirms they've followed up on why the bike failed QC, and the repair
-- can't be re-submitted to QC until it's set.
alter table public.cc_repair_jobs add column if not exists qc_fail_followup_date date;
