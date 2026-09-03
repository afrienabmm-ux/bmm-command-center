-- Sales Advisor: narrow role whose only permission is GenBlu registration
-- (see resolveAllowedPages in lib/permissions.ts), nothing else.
alter table cc_user_profiles drop constraint if exists cc_user_profiles_role_check;
alter table cc_user_profiles add constraint cc_user_profiles_role_check
  check (role in ('Branch PIC', 'Management', 'Administrator', 'Mechanic', 'Front Desk', 'Sales Advisor'));
