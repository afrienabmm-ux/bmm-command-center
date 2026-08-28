-- v1 of an activity log: who logged in and when, plus every
-- team-management action (approvals, role changes, deactivations,
-- deletions, password resets). Visible only to Jason and Afriena — see
-- the /reports/logs page gate, not a role check (Administrator alone
-- isn't enough).
create table if not exists cc_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_name text,
  user_email text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists cc_activity_logs_created_at_idx on cc_activity_logs (created_at desc);
