alter table cc_genblu_transactions add column if not exists service_coupon boolean not null default false;
