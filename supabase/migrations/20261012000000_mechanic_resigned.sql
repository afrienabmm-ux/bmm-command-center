-- A mechanic who has left can't be deleted once they have jobs (deleting
-- blanks the mechanic on every one of them), so they're marked Resigned
-- instead: hidden from the team list, job forms and Today's Job Check, while
-- their past jobs keep their name.
alter table public.cc_mechanics drop constraint if exists cc_mechanics_status_check;
alter table public.cc_mechanics
  add constraint cc_mechanics_status_check check (status in ('Active', 'On Leave', 'Resigned'));
