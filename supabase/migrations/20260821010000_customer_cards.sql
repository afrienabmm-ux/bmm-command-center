-- CRM foundation. Customers themselves aren't stored — they're aggregated
-- on the fly from Walk-in jobsheets (customer_name/revenue) the same way
-- GenBlu points already work. What IS new here:
--   1. cc_package_sales gets a customer link, so "which packages has this
--      customer bought" becomes answerable — it had none before.
--   2. cc_customer_cards — the loyalty/membership card concept (separate
--      from the Services Combo packages), replacing the paper stamp card.
alter table public.cc_package_sales
  add column if not exists customer_name text not null default '',
  add column if not exists customer_plate_no text not null default '';

create table if not exists public.cc_customer_cards (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('kapar', 'setia_alam', 'puncak_alam')),
  customer_name text not null,
  customer_phone text not null default '',
  card_number text not null default '',
  tier text not null default '',
  issued_date date not null default current_date,
  expiry_date date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists cc_customer_cards_branch_idx on public.cc_customer_cards(branch);

-- No policies beyond this — same as every other cc_ table, access goes
-- through the service-role key server-side only.
alter table public.cc_customer_cards enable row level security;
