alter table public.cc_catalog_products
  add column if not exists code text not null default '';

alter table public.cc_catalog_products drop constraint if exists cc_catalog_products_brand_check;
alter table public.cc_catalog_products
  add constraint cc_catalog_products_brand_check check (brand in ('Yamalube', 'Rock Oil', 'Motul', 'Yamaha Spare Parts'));

with new_products as (
  insert into public.cc_catalog_products (brand, category, product_name, spec, price, code) values
    ('Yamaha Spare Parts', 'Air Filter', '[EGO GEAR] ELEMENT ASSY , AIR CLEANER', '', 32.70, 'B5D-E4450-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[EZ115/PG1] ELEMENT ASSY, AIRCLEANER', '', 32.40, '1FC-E4450-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[LC135] ELEMENT ASSY AIR C(5YP-E4450)', '', 17.30, '1S7-E4450-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[NMAX] ELEMENT,1 BC11', '', 31.50, '2DP-E4451-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[NVX V2 /NMAX V2] ELEMENT , AIR CLEANER BBM1 (NVX/NMAX NEW)', '', 45.10, 'B6H-E4451-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[NVX] ELEMENT,1 BG33', '', 38.40, 'B65-E4451-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[R25] ELEMENT;AIR CLEANER 2YD1', '', 52.70, '1WD-E4451-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[SOLARIZ/AVANTIZ] ELEMENT ASSY,AIR CLEANER', '', 24.60, '2PH-E4450-10'),
    ('Yamaha Spare Parts', 'Air Filter', '[SRL115] AIR CLEANER ELEMENT ASSY1', '', 38.00, '1DY-WE445-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[TMAX] ELEMENT AIR CLEANER TMAX', '', 276.00, '4B5-14451-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[XMAX] AIR CLEANER, ELEMENT SET (B741)', '', 91.80, 'B74-WE445-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[XMAX] CVT FILTER ELEMENT 1 BU81', '', 26.30, 'B74-E5407-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[Y15/Y16/LC V8/NVX/NMAX] FUEL FILTER (1VB/2BR1)', '', 65.00, '54P-E3915-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[Y15ZR] ELEMENT ASSY,AIR CLEANER', '', 28.50, '2PV-E4450-09'),
    ('Yamaha Spare Parts', 'Air Filter', '[Y16ZR] ELEMENT ASSY , AIR CLEANER', '', 32.70, 'B5V-E4450-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[EGO GEAR PRO]', '', 0.00, 'BEJ-E4450-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[NMAX,NVX] ELEMENT,1 BC11 (AIR FILTER CVT)', '', 12.30, '2DP-E5407-00'),
    ('Yamaha Spare Parts', 'Air Filter', '[AVANTIZ/SOLARIZ/GEAR/GEAR PRO] ELEMENT,1 B921', '', 8.50, '2PH-E5407-00'),

    ('Yamaha Spare Parts', 'Brake Pad', '[F R15M] BRAKE PAD', '', 196.20, 'B97-W0045-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[R R15] BRAKE PAD KIT 2 B2S1', '', 77.00, 'B97-F5806-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[F LC135/R15/MT15] BRAKE PAD KIT(3C1-W0045-10)2BR', '', 93.10, '3C1-F5805-10'),
    ('Yamaha Spare Parts', 'Brake Pad', '[F LC135] BRAKE PAD KIT', '', 27.10, '5YP-W0045-09'),
    ('Yamaha Spare Parts', 'Brake Pad', '[R LC135] BRAKE PAD KIT,2', '', 65.00, '50C-W0046-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[F Y16ZR] BRAKE PAD KIT', '', 120.10, 'B5V-F5805-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[F Y15ZR] BRAKE PAD KIT FR(2DP1) B171', '', 88.70, '2DP-F5805-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[R Y15ZR/Y16ZR] BRAKE PAD KIT 2 B171', '', 89.30, '1PA-F5806-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[F AVANTIZ/SOLARIZ] BRAKE PAD KIT B921', '', 80.30, '2BM-F5805-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[F NVX] BRAKE PAD KIT BG33', '', 109.40, 'B63-F5805-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[F XMAX] BRAKE PAD KIT BU81', '', 120.90, 'B74-F5805-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[R XMAX] BRAKE PAD KIT 2 BU81', '', 95.80, 'B74-F5806-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[F R25] BRAKE PAD KIT 2YD1', '', 328.50, '1WD-25805-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[R R25] BRAKE PAD KIT2 2YD1', '', 90.30, '1WD-25806-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[F LC135/R15/MT15] [R NMAX] BRAKE PAD KIT(3C1-W0045-10)2BR', '', 93.10, '3C1-F5805-10'),
    ('Yamaha Spare Parts', 'Brake Pad', '[R Y15ZR/Y16ZR/135LC] BRAKE PAD KIT 2 B171', '', 89.30, '1PA-F5806-00'),
    ('Yamaha Spare Parts', 'Brake Pad', '[F AVANTIZ/SOLARIZ/135LC V8/ EGO GEAR/EGO GEAR PRO] BRAKE PAD KIT B921', '', 80.30, '2BM-F5805-00'),

    ('Yamaha Spare Parts', 'V Belt Set', '[AVANTIZ] V BELT SETS (AVANTIZ) 2PH', '', 300.00, '2PH-WE76E-00'),
    ('Yamaha Spare Parts', 'V Belt Set', '[EGO GEAR] V-BELT SET EGO GEAR', '', 273.90, '5VW-CLTH7-01'),
    ('Yamaha Spare Parts', 'V Belt Set', '[NAMX] V BELT SETS (NMAX S) 2DP', '', 346.50, '2DP-WE76E-00'),
    ('Yamaha Spare Parts', 'V Belt Set', '[NVX/NMAX ] V BELT SETS (NVX/NMAX) BDL/BBM', '', 366.60, 'BBP-WE76E-00'),
    ('Yamaha Spare Parts', 'V Belt Set', '[NVX] V BELT SETS (NVX) 155', '', 381.20, 'BG3-WE76E-00'),
    ('Yamaha Spare Parts', 'V Belt Set', '[XMAX] V BELT SETS(XMAX)250', '', 759.80, 'BG6-WE76E-00'),

    ('Yamaha Spare Parts', 'Belting', '[EGO GEAR/AVANTIZ/SOLARIZ] BELT B921', '', 96.70, '2PH-E7641-00'),
    ('Yamaha Spare Parts', 'Belting', '[NEW XMAX] V-BELT', '', 303.50, 'B5X-E7641-00'),
    ('Yamaha Spare Parts', 'Belting', '[NMAX] V BELT BC11', '', 128.70, '2DP-E7641-00'),
    ('Yamaha Spare Parts', 'Belting', '[NVX V2/NMAX V2] V-BELT BDL1', '', 107.80, 'B8R-E7641-00'),
    ('Yamaha Spare Parts', 'Belting', '[NVX] BELT BG33 NVX', '', 98.00, 'B65-E7641-00'),

    ('Yamaha Spare Parts', 'Plug', '[AVANTIZ/SOLARIZ/SLR115] PLUG, SPARK (CR6HSA)(94701-003)', '', 25.90, '94700-00372'),
    ('Yamaha Spare Parts', 'Plug', '[XMAX] PLUG, SPARK (NGK LMAR8A-9)', '', 76.00, '94700-00436'),
    ('Yamaha Spare Parts', 'Plug', '[R15/MT15/R25] PLUG, SPARK (NGK MR8E-9 B2S1)', '', 24.90, '94700-00439'),
    ('Yamaha Spare Parts', 'Plug', '[Y15ZR/FZ150] PLUG,SPARK(NGK R CR8E) B171', '', 17.10, '94700-00330'),
    ('Yamaha Spare Parts', 'Plug', '[R25] PLUG;SPARK(NGKRCR9E) 2YD1', '', 20.50, '94700-00318'),
    ('Yamaha Spare Parts', 'Plug', '[LC135/Y15ZR/NMAX/NVX] PLUG, SPARK (CPR8EA-9)1S81', '', 15.40, '94700-00866'),
    ('Yamaha Spare Parts', 'Plug', '[XMAX/MT25 V2/R25 V2] PLUG, SPARK (NGK LMAR8A-9)', '', 76.00, '94700-00436'),
    ('Yamaha Spare Parts', 'Plug', '[LC135/NMAX/NVX/Y16ZR] PLUG, SPARK (CPR8EA-9)1S81', '', 15.40, '94700-00866'),

    ('Yamaha Spare Parts', 'Sprocket Set', 'SPROCKET DRIVE CHAIN SET Y16ZR', '', 210.00, 'BAX-WF546-00'),
    ('Yamaha Spare Parts', 'Sprocket Set', 'SPROCKET KIT SET (39T) 55D1', '', 103.10, '55D-WF539-10'),
    ('Yamaha Spare Parts', 'Sprocket Set', 'SPROCKET SET Y15ZR', '', 175.00, 'B17-WF542-00')
  returning id
)
insert into public.cc_catalog_stock (product_id, branch, quantity)
select id, branch, 15
from new_products, unnest(array['kapar', 'setia_alam', 'puncak_alam']) as branch;
