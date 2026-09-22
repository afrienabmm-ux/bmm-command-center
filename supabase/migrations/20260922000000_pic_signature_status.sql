-- The Authorised Signature (branch/PIC) line, checked the same way the
-- customer's already is: "detected", "not_detected", "unchecked", or ""
-- (no scan / manual entry). Independent of the existing signature_status
-- column, which is the customer's — a job can be missing either, both,
-- or neither.
alter table public.cc_repair_jobs
  add column if not exists pic_signature_status text not null default '';
