-- Warranty claims: which brand the bike is, so Yamaha and non-Yamaha
-- claims can be tracked and exported separately.
alter table public.cc_warranty_claims
  add column if not exists bike_make text not null default 'Yamaha';
alter table public.cc_warranty_claims
  drop constraint if exists cc_warranty_claims_bike_make_check;
alter table public.cc_warranty_claims
  add constraint cc_warranty_claims_bike_make_check check (bike_make in ('Yamaha', 'Non-Yamaha'));

-- Restore Bike: a required photo of the bike, stored the same way as
-- GenBlu screenshots (private bucket, signed URLs on read).
alter table public.cc_repair_jobs
  add column if not exists image_path text;

insert into storage.buckets (id, name, public)
values ('restore-bike-photos', 'restore-bike-photos', false)
on conflict (id) do nothing;
