-- Email OTP for membership sign-up (/join). A customer verifies their
-- email with a 6-digit code before their card is created — free to run
-- (unlike SMS OTP, which costs money per message).
alter table public.cc_customer_cards
  add column if not exists customer_email text not null default '';

create table if not exists public.cc_email_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  verified boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists cc_email_otps_email_idx on public.cc_email_otps(email);

-- No policies beyond this — same as every other cc_ table, access goes
-- through the service-role key server-side only.
alter table public.cc_email_otps enable row level security;
