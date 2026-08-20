-- Warranty/Delivery Claim status "Approved" renamed to "Proceed" — same 4
-- statuses, just clearer wording for the branch PIC workflow.
alter table public.cc_warranty_claims drop constraint if exists cc_warranty_claims_status_check;
update public.cc_warranty_claims set status = 'Proceed' where status = 'Approved';
alter table public.cc_warranty_claims
  add constraint cc_warranty_claims_status_check
  check (status in ('Proceed', 'In Process', 'Close Ticket', 'Rejected'));

alter table public.cc_delivery_claims drop constraint if exists cc_delivery_claims_status_check;
update public.cc_delivery_claims set status = 'Proceed' where status = 'Approved';
alter table public.cc_delivery_claims
  add constraint cc_delivery_claims_status_check
  check (status in ('Proceed', 'In Process', 'Close Ticket', 'Rejected'));
