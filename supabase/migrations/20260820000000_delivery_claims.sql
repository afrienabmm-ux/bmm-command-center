-- Delivery Claim: damage found on a bike before it's delivered to the
-- customer, tracked separately from Warranty Claim (which is a fault
-- reported after sale) — mirrors "DELIVERY CLAIM FOR YAMAHA/NON-YAMAHA
-- BMM (DAMAGE)".
create table if not exists public.cc_delivery_claims (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('kapar', 'setia_alam', 'puncak_alam')),
  ticket_id text not null,
  pic text not null default '',
  model text not null default '',
  chassis_no text not null default '',
  engine_no text not null default '',
  problem text not null default '',
  status text not null default 'In Process' check (status in ('Approved', 'In Process', 'Close Ticket', 'Rejected')),
  stock_status text not null default 'In Stock' check (stock_status in ('Sold', 'In Stock')),
  plate_no text not null default '',
  date_parts text not null default '',
  delivery text not null default '',
  reason text not null default '',
  submitted_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists cc_delivery_claims_branch_idx on public.cc_delivery_claims(branch);

-- No policies beyond this — same as every other cc_ table, access goes
-- through the service-role key server-side only.
alter table public.cc_delivery_claims enable row level security;
