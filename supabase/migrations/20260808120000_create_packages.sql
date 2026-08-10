create table if not exists public.cc_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12, 2) not null default 0,
  spec text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.cc_package_sales (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('kapar', 'setia_alam', 'puncak_alam')),
  package_id uuid not null references public.cc_packages(id) on delete cascade,
  mechanic_id uuid references public.cc_mechanics(id) on delete set null,
  receipt_id text not null,
  sale_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists cc_package_sales_branch_idx on public.cc_package_sales(branch);
create index if not exists cc_package_sales_package_idx on public.cc_package_sales(package_id);
create index if not exists cc_package_sales_mechanic_idx on public.cc_package_sales(mechanic_id);

alter table public.cc_packages enable row level security;
alter table public.cc_package_sales enable row level security;

-- Seeded with the company's real July service combo packages.
insert into public.cc_packages (name, price, spec, description) values
  ('Pakej Otai Santai', 100, 'RS200+ Oil filter', 'Classic high-performance bundle for daily commuting and smooth engine longevity.'),
  ('Pakej Abang Ah peng', 115, 'RS4GP +Oil filter', 'Premium racing formulation for ultimate protection under high RPM demands.'),
  ('Pakej Kita Rider', 95, 'RS10w-40 + Oil filter', 'Reliable everyday package tailored for courier and heavy city riders.'),
  ('Pakej Ride Sempoi', 65, 'RS500+ Oil filter', 'Budget-friendly maintenance package keeping your ride crisp and clean.')
on conflict do nothing;
