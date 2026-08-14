-- Collapse the 4-value role (Manager/Admin/Mechanic PIC/IT) down to a
-- simple 2-level access level: Branch PIC (locked to their own branch) and
-- Management (can access every branch). Per-page permission customization
-- (allowed_pages) goes away too — every approved user now sees every page,
-- access is controlled by branch scope alone.
alter table public.cc_user_profiles
  drop constraint if exists cc_user_profiles_role_check;

update public.cc_user_profiles
  set role = 'Management'
  where role in ('Manager', 'Admin', 'IT');

update public.cc_user_profiles
  set role = 'Branch PIC'
  where role = 'Mechanic PIC';

alter table public.cc_user_profiles
  add constraint cc_user_profiles_role_check check (role in ('Branch PIC', 'Management'));

alter table public.cc_user_profiles
  drop column if exists allowed_pages;

-- First-user-becomes-admin bootstrap trigger now grants Management instead
-- of Manager.
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
    values (new.id, new.email, meta_name, 'Management', meta_branch, 'approved', now());
  else
    insert into public.cc_user_profiles (id, email, name, home_branch, status)
    values (new.id, new.email, meta_name, meta_branch, 'pending');
  end if;
  return new;
end;
$$;
