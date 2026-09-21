-- A read-only database login for the Hermes assistant.
--
-- It can only SELECT from a handful of views in its own "hermes" schema. The
-- views leave out anything private (IC numbers, phone numbers, engine/chassis
-- numbers, photo paths, GenBlu membership numbers), and the role itself is
-- locked to read-only transactions with a short time limit. It has NO
-- password here on purpose — a person sets one in the Supabase SQL editor so
-- the secret never lives in the code.

create schema if not exists hermes;

create or replace view hermes.jobs as
select
  j.id, j.branch, j.job_no, j.customer_name, j.plate_no, j.model, j.bike_year, j.condition,
  j.job_type, j.service_type, j.status, j.revenue_amount, j.deal_type,
  j.form_date, j.started_date, j.completed_date, j.next_service_date,
  j.mileage_km, j.next_mileage_km, j.mechanic_id, j.pic_name,
  j.qc_result, j.qc_date, j.remark,
  -- Rough "has GenBlu": a registration exists for this plate. The dashboard's
  -- own tick is stricter (it also matches the points to the job's cost).
  exists (
    select 1 from public.cc_genblu_registrations r
    where regexp_replace(upper(coalesce(r.customer_plate_no, '')), '[^A-Z0-9]', '', 'g')
        = regexp_replace(upper(coalesce(j.plate_no, '')), '[^A-Z0-9]', '', 'g')
      and coalesce(j.plate_no, '') <> ''
  ) as has_genblu_registration
from public.cc_repair_jobs j;

create or replace view hermes.job_items as
select id, job_id, code, description, quantity, price from public.cc_repair_job_items;

create or replace view hermes.genblu_registrations as
select id, branch, salesperson_name, customer_name, customer_plate_no, points_accrued, source, created_at
from public.cc_genblu_registrations;

create or replace view hermes.genblu_transactions as
select id, branch, customer_name, product_category, points, transaction_date, transaction_time, created_at
from public.cc_genblu_transactions;

create or replace view hermes.mechanics as
select id, branch, full_name, short_name, category, status from public.cc_mechanics;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'hermes_reader') then
    create role hermes_reader login noinherit nocreatedb nocreaterole nobypassrls connection limit 3;
  end if;
end $$;

alter role hermes_reader set default_transaction_read_only = on;
alter role hermes_reader set statement_timeout = '15s';

revoke all on all tables in schema public from hermes_reader;
grant usage on schema hermes to hermes_reader;
grant select on all tables in schema hermes to hermes_reader;
