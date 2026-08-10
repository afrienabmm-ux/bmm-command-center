create table if not exists public.cc_catalog_stock (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.cc_catalog_products(id) on delete cascade,
  branch text not null check (branch in ('kapar', 'setia_alam', 'puncak_alam')),
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id, branch)
);

create index if not exists cc_catalog_stock_branch_idx on public.cc_catalog_stock(branch);
create index if not exists cc_catalog_stock_product_idx on public.cc_catalog_stock(product_id);

alter table public.cc_catalog_stock enable row level security;
