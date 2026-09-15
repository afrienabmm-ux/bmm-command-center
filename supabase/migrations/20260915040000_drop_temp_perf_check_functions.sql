-- Cleanup for the one-off performance audit (get_rls_policies,
-- get_table_stats) — no longer needed.
drop function if exists public.get_rls_policies();
drop function if exists public.get_table_stats();
