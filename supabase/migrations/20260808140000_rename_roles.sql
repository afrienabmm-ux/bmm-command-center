-- Rename the two access roles: Manager -> Admin, Staff -> Mechanic PIC.
alter table public.cc_user_profiles drop constraint if exists cc_user_profiles_role_check;

update public.cc_user_profiles set role = 'Admin' where role = 'Manager';
update public.cc_user_profiles set role = 'Mechanic PIC' where role = 'Staff';

alter table public.cc_user_profiles
  add constraint cc_user_profiles_role_check check (role in ('Admin', 'Mechanic PIC'));

-- Bootstrap trigger: the very first sign-up becomes an approved Admin.
create or replace function public.cc_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text := coalesce(new.raw_user_meta_data->>'name', '');
  meta_branch text := coalesce(new.raw_user_meta_data->>'home_branch', 'kapar');
begin
  if not exists (select 1 from public.cc_user_profiles) then
    insert into public.cc_user_profiles (id, email, name, role, home_branch, status, approved_at)
    values (new.id, new.email, meta_name, 'Admin', meta_branch, 'approved', now());
  else
    insert into public.cc_user_profiles (id, email, name, home_branch, status)
    values (new.id, new.email, meta_name, meta_branch, 'pending');
  end if;
  return new;
end;
$$;
