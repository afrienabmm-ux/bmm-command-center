create extension if not exists pgcrypto;

-- === User profiles / access control =========================================

create table if not exists public.cc_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text check (role in ('Manager', 'Staff')),
  home_branch text not null check (home_branch in ('kapar', 'setia_alam', 'puncak_alam')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  approved_by uuid references public.cc_user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.cc_user_profiles enable row level security;

-- Signed-in users can read their own profile row (needed by middleware/pages
-- to check approval status). Everything else goes through the service-role
-- key server-side only.
create policy "read own profile" on public.cc_user_profiles
  for select using (auth.uid() = id);

-- New sign-ups get a profile row automatically. The very first person to
-- ever sign up becomes an approved Manager (bootstraps the system). Everyone
-- after that starts out pending until a Manager approves them.
create or replace function public.cc_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text := coalesce(new.raw_user_meta_data->>'name', '');
  meta_branch text := coalesce(new.raw_user_meta_data->>'home_branch', 'kapar');
begin
  if not exists (select 1 from public.cc_user_profiles) then
    insert into public.cc_user_profiles (id, email, name, role, home_branch, status, approved_at)
    values (new.id, new.email, meta_name, 'Manager', meta_branch, 'approved', now());
  else
    insert into public.cc_user_profiles (id, email, name, home_branch, status)
    values (new.id, new.email, meta_name, meta_branch, 'pending');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.cc_handle_new_user();

-- === Monthly sales targets ===================================================

create table if not exists public.cc_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('kapar', 'setia_alam', 'puncak_alam')),
  year int not null,
  month int not null check (month between 1 and 12),
  target_amount numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (branch, year, month)
);

-- === Mechanics ================================================================

create table if not exists public.cc_mechanics (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('kapar', 'setia_alam', 'puncak_alam')),
  full_name text not null,
  short_name text not null,
  short_code text not null,
  status text not null default 'Active' check (status in ('Active', 'On Leave')),
  created_at timestamptz not null default now()
);

create index if not exists cc_mechanics_branch_idx on public.cc_mechanics(branch);

-- === Warranty claims ==========================================================

create table if not exists public.cc_warranty_claims (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('kapar', 'setia_alam', 'puncak_alam')),
  claim_no text not null,
  customer_name text not null,
  plate_no text not null,
  description text not null default '',
  status text not null default 'Submitted' check (status in ('Submitted', 'Approved', 'Rejected', 'Completed')),
  submitted_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists cc_warranty_claims_branch_idx on public.cc_warranty_claims(branch);

-- === Workshop repair jobs =====================================================

create table if not exists public.cc_repair_jobs (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('kapar', 'setia_alam', 'puncak_alam')),
  job_no text not null,
  customer_name text not null,
  plate_no text not null,
  job_type text not null check (job_type in ('Restore Bike', 'Walk-in')),
  mechanic_id uuid references public.cc_mechanics(id) on delete set null,
  description text not null default '',
  status text not null default 'Pending' check (status in ('Pending', 'In Progress', 'Completed')),
  revenue_amount numeric(12, 2) not null default 0,
  started_date date not null default current_date,
  completed_date date,
  created_at timestamptz not null default now()
);

create index if not exists cc_repair_jobs_branch_idx on public.cc_repair_jobs(branch);
create index if not exists cc_repair_jobs_status_idx on public.cc_repair_jobs(status);
create index if not exists cc_repair_jobs_mechanic_idx on public.cc_repair_jobs(mechanic_id);

-- === GenBlu app registrations ================================================

create table if not exists public.cc_genblu_registrations (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('kapar', 'setia_alam', 'puncak_alam')),
  salesperson_name text not null,
  salesperson_code text not null default '',
  customer_plate_no text not null,
  screenshot_path text,
  created_at timestamptz not null default now()
);

create index if not exists cc_genblu_registrations_branch_idx on public.cc_genblu_registrations(branch);

-- === Product catalog (Yamalube / Rock Oil / Motul) ===========================

create table if not exists public.cc_catalog_products (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('Yamalube', 'Rock Oil', 'Motul')),
  category text not null default '',
  product_name text not null,
  spec text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists cc_catalog_products_brand_idx on public.cc_catalog_products(brand);

-- RLS enabled with no policies on the operational tables below: only the
-- service_role key (used server-side only, never shipped to the browser)
-- can read/write them.
alter table public.cc_monthly_targets enable row level security;
alter table public.cc_mechanics enable row level security;
alter table public.cc_warranty_claims enable row level security;
alter table public.cc_repair_jobs enable row level security;
alter table public.cc_genblu_registrations enable row level security;
alter table public.cc_catalog_products enable row level security;

-- Starter catalog rows so the Catalog page isn't empty on first load —
-- real product names/prices should be added via the Add Product button.
insert into public.cc_catalog_products (brand, category, product_name, spec) values
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Yamalube Oil Filter (example)', 'Add your real SKU/price'),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Spark Plug (example)', 'Add your real SKU/price'),
  ('Rock Oil', 'Engine Oil', 'Rock Oil Product (example)', 'Add your real SKU/price'),
  ('Motul', 'Engine Oil', 'Motul Product (example)', 'Add your real SKU/price')
on conflict do nothing;
