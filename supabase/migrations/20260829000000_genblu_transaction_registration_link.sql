alter table cc_genblu_transactions
  add column registration_id uuid references cc_genblu_registrations(id) on delete set null;
