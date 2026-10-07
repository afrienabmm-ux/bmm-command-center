-- These three tables were created without row level security, so the public
-- (anon) key shipped to every browser could read them straight through the
-- API. Same treatment as every other cc_ table: RLS on, no policies — the
-- app only ever reads them server-side with the service role, which isn't
-- affected, and the hermes views run as their owner, so they're unaffected too.
alter table public.cc_genblu_transactions enable row level security;
alter table public.cc_genblu_reports enable row level security;
alter table public.cc_activity_logs enable row level security;
