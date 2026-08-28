-- Stamp progress used to be calculated automatically from jobsheet visit
-- counts. Admin now ticks stamps by hand on the Services Card page, fully
-- independent of jobsheet activity.
alter table cc_customer_cards add column if not exists stamps integer[] not null default '{}';
