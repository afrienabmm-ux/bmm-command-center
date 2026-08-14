-- Update the 4 Services Combo packages to match the latest "Service
-- Combo!!" promo poster (name, price, spec).
update public.cc_packages set price = 130, spec = 'RSGP 4T Ester 10w40 + Oil filter' where name = 'Pakej Abang Ah peng';
update public.cc_packages set price = 125, spec = 'RS 200 Ester 10w50 + Oil filter' where name = 'Pakej Otai Santai';
update public.cc_packages set price = 120, spec = 'RS RT Ester 10w40 + Oil filter' where name = 'Pakej Kita Rider';
update public.cc_packages set price = 85, spec = 'RS500 Semi-synthetic 15w50 + Oil filter' where name = 'Pakej Ride Sempoi';
