-- GenBlu becomes a customer points tracker (1 point = RM1 spent), not just
-- a "who installed the app" log — needs the customer's name to match
-- against jobsheet/Walk-in job spending.
alter table public.cc_genblu_registrations
  add column if not exists customer_name text not null default '';
