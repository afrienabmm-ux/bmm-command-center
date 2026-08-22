alter table public.cc_customer_cards add column if not exists bought_bike_here boolean not null default false;

-- Grandfather in every card that already exists before this eligibility
-- rule was introduced — only newly created cards need explicit staff (or
-- customer, on /join) confirmation going forward.
update public.cc_customer_cards set bought_bike_here = true where bought_bike_here = false;
