-- Records what the jobsheet scan actually found for the customer
-- signature check ('detected' / 'not_detected' / 'unchecked'), separate
-- from the staff member's own confirmation checkbox — so if someone ticks
-- "Customer has signed" despite the scan finding nothing, that's a
-- traceable claim on the job record instead of forgotten the moment the
-- form closes. Empty string means no scan ran for this job (manual entry).
alter table public.cc_repair_jobs
  add column if not exists signature_status text not null default '';
