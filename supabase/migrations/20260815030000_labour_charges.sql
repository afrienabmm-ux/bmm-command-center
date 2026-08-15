create table if not exists public.cc_labour_charges (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  price_0_125cc text not null default '',
  price_125_200cc text not null default '',
  price_200cc_plus text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.cc_labour_charges enable row level security;

insert into public.cc_labour_charges (description, price_0_125cc, price_125_200cc, price_200cc_plus, sort_order) values
  ('Plug', 'N/A', 'RM 20', 'RM 100-120', 1),
  ('Flushing Coolant', 'N/A', 'RM 40', 'RM 80', 2),
  ('Diagnostic', 'N/A', 'RM 40', 'N/A', 3),
  ('CVT', 'RM 40', 'RM 40', 'RM 60', 4),
  ('Top Set', 'RM 80', 'RM 150', 'RM 500', 5),
  ('Valve Clearance', 'N/A', 'RM 150', 'RM 500', 6),
  ('Overhaul', 'RM 250', 'RM 500', 'RM 1k', 7),
  ('Skru Lock Camp', 'N/A', 'N/A', 'RM 450', 8),
  ('Cuci Caburetor', 'RM 45', 'N/A', 'N/A', 9),
  ('Balancing Tires', 'RM 20', 'RM 20', 'RM 20', 10);
