alter table public.cc_catalog_products
  add column if not exists price numeric not null default 0;
