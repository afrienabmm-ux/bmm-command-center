-- Workflow redesign: GM Approved is no longer its own stamp — it's just
-- the existing Approval dropdown (Pending/Approved/Not Approved). Arrived
-- Date moves from a click-button into a regular form field. Started Date
-- becomes a click-to-stamp value gated on approval, so it can no longer
-- default to "today" the moment a job is created — the top-of-form date
-- field is repurposed to mean "date this form was filled in" instead, and
-- needs its own column so it doesn't collide with the click-driven
-- Started Date.
alter table public.cc_repair_jobs
  drop column if exists gm_approved_date;

alter table public.cc_repair_jobs
  alter column started_date drop not null;
alter table public.cc_repair_jobs
  alter column started_date drop default;

alter table public.cc_repair_jobs
  add column if not exists form_date date;
