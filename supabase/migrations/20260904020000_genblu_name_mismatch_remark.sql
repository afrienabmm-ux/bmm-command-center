-- A GenBlu screenshot whose name doesn't match the customer on file is no
-- longer blocked outright (a genuine case — e.g. using a spouse's GenBlu
-- account — kept getting rejected as if it were a mistake). Staff can now
-- confirm past the warning with a short note explaining why, stored here
-- so admin can see the reason later instead of just a silent override.
alter table public.cc_genblu_registrations add column if not exists name_mismatch_remark text;
