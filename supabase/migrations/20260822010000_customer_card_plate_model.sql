alter table public.cc_customer_cards add column if not exists plate_no text not null default '';
alter table public.cc_customer_cards add column if not exists model text not null default '';
