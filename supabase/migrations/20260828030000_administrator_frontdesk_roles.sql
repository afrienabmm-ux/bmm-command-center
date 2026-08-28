-- Administrator: same full access as Management, just a separate label for
-- the GM/IT accounts. Front Desk: narrow role that only ticks stamps on
-- the Services Card page, nothing else.
alter table cc_user_profiles drop constraint if exists cc_user_profiles_role_check;
alter table cc_user_profiles add constraint cc_user_profiles_role_check
  check (role in ('Branch PIC', 'Management', 'Administrator', 'Mechanic', 'Front Desk'));
