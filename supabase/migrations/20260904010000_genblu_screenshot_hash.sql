-- Content hash of each uploaded GenBlu screenshot — lets the app warn staff
-- when the exact same photo is being uploaded a second time (e.g. once at
-- registration, again via Point Allocation for the same visit), instead of
-- silently double-crediting points with no way to catch it after the fact.
alter table public.cc_genblu_registrations add column if not exists screenshot_hash text;
alter table public.cc_genblu_transactions add column if not exists screenshot_hash text;

create index if not exists cc_genblu_registrations_hash_idx on public.cc_genblu_registrations(branch, screenshot_hash);
create index if not exists cc_genblu_transactions_hash_idx on public.cc_genblu_transactions(branch, screenshot_hash);
