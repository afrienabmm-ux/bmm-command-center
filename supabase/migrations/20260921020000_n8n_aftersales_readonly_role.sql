-- A read-only database login for n8n automations on the After-Sales data.
-- Same safe views as the Hermes login (schema "hermes": no IC / phone numbers,
-- no engine/chassis, no photo paths, no GenBlu membership numbers), but its own
-- login so either tool can be removed without touching the other. No password
-- is set here on purpose — a person sets one in the Supabase SQL editor.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'n8n_aftersales_reader') then
    create role n8n_aftersales_reader login noinherit nocreatedb nocreaterole nobypassrls connection limit 3;
  end if;
end $$;

alter role n8n_aftersales_reader set default_transaction_read_only = on;
alter role n8n_aftersales_reader set statement_timeout = '15s';

revoke all on all tables in schema public from n8n_aftersales_reader;
grant usage on schema hermes to n8n_aftersales_reader;
grant select on all tables in schema hermes to n8n_aftersales_reader;
