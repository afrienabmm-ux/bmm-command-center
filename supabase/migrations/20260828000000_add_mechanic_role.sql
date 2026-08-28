-- A new, narrower access level for mechanics who only ever need to scan
-- and save jobsheets from their phone — everything else (Dashboard,
-- Restore Bike, Claims, GenBlu, Reports, etc.) is hidden for this role,
-- unlike Branch PIC which sees every page.
alter table public.cc_user_profiles
  drop constraint if exists cc_user_profiles_role_check;

alter table public.cc_user_profiles
  add constraint cc_user_profiles_role_check check (role in ('Branch PIC', 'Management', 'Mechanic'));
