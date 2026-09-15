-- Temporary — added only to read table sizes and index coverage for a
-- one-off performance audit, called once via supabase.rpc() and then
-- dropped again in a follow-up migration. Not part of the app itself.
create or replace function public.get_table_stats()
returns table(tablename text, approx_rows bigint, index_list text)
language sql
security definer
as $$
  select
    c.relname,
    c.reltuples::bigint,
    coalesce((
      select string_agg(indexname, ' | ')
      from pg_indexes ix
      where ix.tablename = c.relname and ix.schemaname = 'public'
    ), '')
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.reltuples desc;
$$;
