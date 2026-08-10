alter table public.cc_user_profiles drop constraint if exists cc_user_profiles_role_check;

alter table public.cc_user_profiles
  add constraint cc_user_profiles_role_check check (role in ('Manager', 'Admin', 'Mechanic PIC', 'IT'));
