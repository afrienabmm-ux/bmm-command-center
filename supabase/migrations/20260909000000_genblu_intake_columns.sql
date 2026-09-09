-- Columns needed to receive GenBlu registrations forwarded from the
-- separate Sales Dashboard (see app/api/genblu-intake/route.ts).
--
-- external_source_id: the Sales Dashboard's own id for the registration —
-- stored so a retried delivery (their webhook retries up to 5 times on any
-- non-2xx response) can be recognized and skipped instead of creating a
-- duplicate row. Nullable and only unique when present, since every
-- registration created directly in this app has no such id.
alter table public.cc_genblu_registrations
  add column if not exists external_source_id text,
  add column if not exists member_id text;

create unique index if not exists cc_genblu_registrations_external_source_id_idx
  on public.cc_genblu_registrations (external_source_id)
  where external_source_id is not null;
