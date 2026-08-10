-- Three roles now: Manager (top), Admin, Mechanic PIC.
alter table public.cc_user_profiles drop constraint if exists cc_user_profiles_role_check;

alter table public.cc_user_profiles
  add constraint cc_user_profiles_role_check check (role in ('Manager', 'Admin', 'Mechanic PIC'));

-- Per-user page access. NULL means "use the role's default set" — a Manager
-- can override it per person to hide/show individual functions.
alter table public.cc_user_profiles
  add column if not exists allowed_pages text[];

-- The very first sign-up bootstraps as an approved Manager.
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
    values (new.id, new.email, meta_name, 'Manager', meta_branch, 'approved', now());
  else
    insert into public.cc_user_profiles (id, email, name, home_branch, status)
    values (new.id, new.email, meta_name, meta_branch, 'pending');
  end if;
  return new;
end;
$$;

-- Promote the existing bootstrap Admin (the first account created) to Manager.
update public.cc_user_profiles
set role = 'Manager'
where id = (select id from public.cc_user_profiles order by created_at limit 1);
