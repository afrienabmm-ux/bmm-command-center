-- "Workshop" covers internal line items that aren't a real stocked
-- product (labour charges, discounts/FOC, package promos) — same table
-- as real parts so they show up in the same code/description search on
-- a jobsheet, just under their own brand instead of a manufacturer's.
alter table public.cc_catalog_products drop constraint if exists cc_catalog_products_brand_check;
alter table public.cc_catalog_products
  add constraint cc_catalog_products_brand_check check (brand in ('Yamalube', 'Rock Oil', 'Motul', 'Yamaha Spare Parts', 'Workshop'));
