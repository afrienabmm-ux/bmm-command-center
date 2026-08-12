alter table public.cc_mechanics
  add column if not exists category text not null default 'Fast Repair';

alter table public.cc_mechanics
  drop constraint if exists cc_mechanics_category_check;
alter table public.cc_mechanics
  add constraint cc_mechanics_category_check check (category in ('Heavy Repair', 'Fast Repair', 'Combo Repair'));

alter table public.cc_repair_jobs
  add column if not exists is_big_item boolean not null default false;

-- Designated heavy-repair mechanics, one (or more) per branch.
update public.cc_mechanics set category = 'Heavy Repair' where short_name in ('SABIT', 'TAUFIQ', 'ARWIND', 'PENG');
