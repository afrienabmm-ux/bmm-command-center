alter table public.cc_warranty_claims
  add column if not exists pic text not null default '',
  add column if not exists latest_status text not null default '',
  add column if not exists reason text not null default '';

-- Their sheet tracks rejected and closed claims (and counts them per
-- person), neither of which could be recorded before.
alter table public.cc_warranty_claims drop constraint if exists cc_warranty_claims_status_check;
alter table public.cc_warranty_claims
  add constraint cc_warranty_claims_status_check
  check (status in ('Pending', 'In Progress', 'Approved', 'Rejected', 'Closed'));
