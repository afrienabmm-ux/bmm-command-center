-- Claim statuses move to the 4-option set the printed form uses: Approved,
-- In Process, Close Ticket, Rejected. "Pending" and "In Progress" both
-- collapse into "In Process" (there's no separate not-yet-started state on
-- the form), and "Closed" becomes "Close Ticket".
alter table public.cc_warranty_claims drop constraint if exists cc_warranty_claims_status_check;

update public.cc_warranty_claims
  set status = case status
    when 'Pending' then 'In Process'
    when 'In Progress' then 'In Process'
    when 'Closed' then 'Close Ticket'
    else status
  end;

alter table public.cc_warranty_claims
  add constraint cc_warranty_claims_status_check
  check (status in ('Approved', 'In Process', 'Close Ticket', 'Rejected'));
