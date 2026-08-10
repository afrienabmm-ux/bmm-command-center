alter table public.cc_user_profiles drop constraint if exists cc_user_profiles_home_branch_check;

alter table public.cc_user_profiles
  add constraint cc_user_profiles_home_branch_check check (home_branch in ('kapar', 'setia_alam', 'puncak_alam', 'all'));
