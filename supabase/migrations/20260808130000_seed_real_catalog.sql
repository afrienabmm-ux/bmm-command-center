-- Remove the placeholder rows shipped before real product data was available.
delete from public.cc_catalog_products where product_name ilike '%(example)%';

-- Yamalube: general service parts for the 20,000km-and-below service.
insert into public.cc_catalog_products (brand, category, product_name, spec) values
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Oil Filter', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Gear Oil', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Engine Oil', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Carbon Cleaner', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Spark Plug Motor', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Brake Pad', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Brake Shoe', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Air Filter', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Sprocket Set', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'V-Belt Set', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Tayar', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Fuel Filter', ''),
  ('Yamalube', 'Produk Servis 20,000KM Kebawah', 'Needle Bearing', '');

-- Yamalube: Minyak Yamalube oil range.
insert into public.cc_catalog_products (brand, category, product_name, spec) values
  ('Yamalube', 'Fully Synthetic', 'RS4GP 4T Ester', '10W-40'),
  ('Yamalube', 'Fully Synthetic', 'RS200 Ester', '10W-50'),
  ('Yamalube', 'Fully Synthetic', 'RS 4T Ester', '10W-40'),
  ('Yamalube', 'Fully Synthetic', 'AT Max Blue Core', '5W-40'),
  ('Yamalube', 'Fully Synthetic', '4T', '10W-40'),
  ('Yamalube', 'Semi Synthetic', 'RS Ester', '10W-30 / 10W-50'),
  ('Yamalube', 'Semi Synthetic', '4T', '10W-40'),
  ('Yamalube', 'Semi Synthetic', 'AT Blue Core', '10W-40'),
  ('Yamalube', 'Semi Synthetic', '4T', '10W-30'),
  ('Yamalube', 'Mineral', 'AT', '20W-40'),
  ('Yamalube', 'Mineral', '4T', '20W-40'),
  ('Yamalube', 'Mineral', '4T (850ml)', '20W-40'),
  ('Yamalube', 'Others', 'Gear Oil', ''),
  ('Yamalube', 'Others', 'Coolant', ''),
  ('Yamalube', 'Others', 'CVT Grease', ''),
  ('Yamalube', 'Others', 'Chain Lube', ''),
  ('Yamalube', 'Others', 'Parts Cleaner', ''),
  ('Yamalube', 'Others', 'Anti Rust', ''),
  ('Yamalube', 'Others', 'Carbon Cleaner', '');

-- Rock Oil range.
insert into public.cc_catalog_products (brand, category, product_name, spec) values
  ('Rock Oil', 'Advanced Synthetic', 'Synthesis 4T Motorcycle', '10W-40'),
  ('Rock Oil', 'Advanced Synthetic', 'Synthesis Motorcycle', '10W-30'),
  ('Rock Oil', 'Advanced Synthetic', 'Synthesis 4 Racing', '15W-50'),
  ('Rock Oil', 'Advanced Synthetic', 'Guardian Plus Racing', '10W-50'),
  ('Rock Oil', 'Advanced Synthetic', 'Guardian Plus Racing', '10W-40'),
  ('Rock Oil', 'Semi Synthetic', 'Guardian Motorcycle', '10W-40'),
  ('Rock Oil', 'Semi Synthetic', 'Guardian Motorcycle', '20W-50'),
  ('Rock Oil', 'Semi Synthetic', 'Guardian Motorcycle Semi', '10W-30'),
  ('Rock Oil', 'Semi Synthetic', 'Guardian Motorcycle', '10W-50'),
  ('Rock Oil', 'Semi Synthetic', 'Motorcycle', '15W-50'),
  ('Rock Oil', 'Semi Synthetic', 'Motorcycle Semi Synthetic', '15W-50'),
  ('Rock Oil', 'Semi Synthetic', 'Motorcycle', '15W-40'),
  ('Rock Oil', 'Semi Scooter', 'Oil City 4', '10W-30'),
  ('Rock Oil', 'Semi Scooter', 'Scooter', '10W-40'),
  ('Rock Oil', 'Semi Scooter', 'Scooter', '10W-40'),
  ('Rock Oil', 'Semi Scooter', 'City 4 Plus Semi Synthetic Scooter', '5W-40'),
  ('Rock Oil', 'Semi Scooter', 'City 4 Plus', '5W-50'),
  ('Rock Oil', 'Fully Scooter', 'City 4 Plus Fully Synth Scooter', '5W-40'),
  ('Rock Oil', 'Fully Scooter', 'City 4 Plus', '5W-50'),
  ('Rock Oil', 'Others', 'Gearbox Racing Oil', '50ml'),
  ('Rock Oil', 'Others', 'Rock Oil Iced Kool', 'Cooling spray'),
  ('Rock Oil', 'Others', 'Rock Oil Fork Oil SVI', '15'),
  ('Rock Oil', 'Others', 'Rock Oil Brake Kleen', 'Spray'),
  ('Rock Oil', 'Others', 'Rock Oil Chain Lube', '200ml');

-- Motul range.
insert into public.cc_catalog_products (brand, category, product_name, spec) values
  ('Motul', 'Engine Oil', 'Motul 5100', '15W-40 — Recreational & Commuting, Technosynthese'),
  ('Motul', 'Engine Oil', 'Motul 7000', '10W-40 — Sport & Adventure, 100% Synthetic'),
  ('Motul', 'Engine Oil', 'Motul 7100', '15W-50 — Sport & Adventure, 100% Synthetic'),
  ('Motul', 'Engine Oil', 'Motul Scooter Power LE MB', '5W-40 — Power Leisure, 100% Synthetic');
