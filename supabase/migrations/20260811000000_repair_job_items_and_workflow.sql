alter table public.cc_repair_jobs
  add column if not exists stock_order_date date,
  add column if not exists stock_arrive_date date,
  add column if not exists prepared_by text not null default '',
  add column if not exists approval_status text not null default 'Pending';

alter table public.cc_repair_jobs drop constraint if exists cc_repair_jobs_approval_status_check;
alter table public.cc_repair_jobs
  add constraint cc_repair_jobs_approval_status_check check (approval_status in ('Pending', 'Approved', 'Not Approved'));

create table if not exists public.cc_repair_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cc_repair_jobs(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  price numeric not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cc_repair_job_items_job_id_idx on public.cc_repair_job_items(job_id);

alter table public.cc_repair_job_items enable row level security;
