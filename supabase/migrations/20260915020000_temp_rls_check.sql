-- Temporary — added only to read RLS policy definitions for a one-off
-- performance audit, called once via supabase.rpc() and then dropped again
-- in a follow-up migration. Not part of the app itself.
create or replace function public.get_rls_policies()
returns table(tablename text, policyname text, cmd text, qual text, with_check text)
language sql
security definer
as $$
  select tablename, policyname, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname;
$$;
