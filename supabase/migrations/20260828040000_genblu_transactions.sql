-- Logs one row per GenBlu points award, read entirely from the app
-- screenshot via OCR — separate from cc_genblu_registrations (which tracks
-- whether a customer is enrolled at all, for the Jobsheet "has GenBlu?"
-- checkbox). This table exists so monthly counts/points can be totalled
-- per branch, matching the admin's own spreadsheet "Finding" summary.
create table if not exists cc_genblu_transactions (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  customer_name text not null,
  membership_number text,
  product_category text,
  points integer not null default 0,
  transaction_date date,
  screenshot_path text,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists cc_genblu_transactions_branch_date_idx
  on cc_genblu_transactions (branch, transaction_date);
