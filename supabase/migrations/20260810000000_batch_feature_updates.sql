-- Warranty claims: new fields + simplified status set matching the real
-- workshop tracking sheet (Ticket ID, Model, Phone, Stock Status).
alter table public.cc_warranty_claims
  add column if not exists model text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists stock_status text not null default 'In Stock';

alter table public.cc_warranty_claims drop constraint if exists cc_warranty_claims_stock_status_check;
alter table public.cc_warranty_claims
  add constraint cc_warranty_claims_stock_status_check check (stock_status in ('Sold', 'In Stock'));

alter table public.cc_warranty_claims drop constraint if exists cc_warranty_claims_status_check;
update public.cc_warranty_claims set status = 'Pending' where status in ('Submitted', 'Rejected');
update public.cc_warranty_claims set status = 'Approved' where status = 'Completed';
alter table public.cc_warranty_claims
  add constraint cc_warranty_claims_status_check check (status in ('Pending', 'In Progress', 'Approved'));

-- Repair jobs: what happened to the trade-in/old bike, if anything.
alter table public.cc_repair_jobs
  add column if not exists deal_type text not null default '';

-- User profiles: a free-text display title for roles like "HR" that aren't
-- one of the 3 real permission tiers. The underlying `role` column still
-- drives what they can access; this is just what's shown for them.
alter table public.cc_user_profiles
  add column if not exists position_title text;
