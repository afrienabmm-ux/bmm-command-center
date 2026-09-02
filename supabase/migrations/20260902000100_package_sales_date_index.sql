-- Same gap as cc_repair_jobs: every revenue/achieved query filters
-- cc_package_sales by branch + sale_date range, but only branch/package/
-- mechanic had indexes — sale_date range filtering had nothing to use.
create index if not exists cc_package_sales_branch_sale_date_idx
  on public.cc_package_sales (branch, sale_date);
