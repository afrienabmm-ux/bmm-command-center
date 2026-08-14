-- Remaining jobsheet fields not yet on the Walk-in form: Sales No./Date,
-- Warranty Card No., the jobsheet's own Job No., mileage, service type,
-- next service date.
alter table public.cc_repair_jobs
  add column if not exists jobsheet_no text not null default '';
alter table public.cc_repair_jobs
  add column if not exists sales_no text not null default '';
alter table public.cc_repair_jobs
  add column if not exists sales_date text not null default '';
alter table public.cc_repair_jobs
  add column if not exists warranty_card_no text not null default '';
alter table public.cc_repair_jobs
  add column if not exists mileage_km text not null default '';
alter table public.cc_repair_jobs
  add column if not exists next_mileage_km text not null default '';
alter table public.cc_repair_jobs
  add column if not exists service_type text not null default '';
alter table public.cc_repair_jobs
  add column if not exists next_service_date text not null default '';
