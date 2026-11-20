-- 2026-11-20: "Picked up" tick on finished Walk-in jobs. Only After-Sales sets it;
-- the Customer Service Tracker just shows it.
alter table cc_repair_jobs add column if not exists picked_up_at timestamptz;
alter table cc_repair_jobs add column if not exists picked_up_by text not null default '';
