-- Bikes over 250cc aren't eligible for a services card. Grandfather in
-- every card that already exists before this rule was introduced — same
-- pattern used for the bought_bike_here eligibility check.
alter table public.cc_customer_cards add column if not exists under_250cc boolean not null default true;
