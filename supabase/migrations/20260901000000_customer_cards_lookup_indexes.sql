-- Adding/editing a Services Card checks customer_phone for duplicates and
-- card_number for collisions on every save — both previously unindexed
-- full-table scans.
create index if not exists cc_customer_cards_phone_idx on public.cc_customer_cards(customer_phone);
create index if not exists cc_customer_cards_card_number_idx on public.cc_customer_cards(card_number);
