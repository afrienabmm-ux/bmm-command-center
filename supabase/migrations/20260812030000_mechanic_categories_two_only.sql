alter table public.cc_mechanics
  drop constraint if exists cc_mechanics_category_check;

update public.cc_mechanics set category = 'Normal Repair' where category in ('Fast Repair', 'Combo Repair');

alter table public.cc_mechanics
  add constraint cc_mechanics_category_check check (category in ('Heavy Repair', 'Normal Repair'));

alter table public.cc_mechanics
  alter column category set default 'Normal Repair';
