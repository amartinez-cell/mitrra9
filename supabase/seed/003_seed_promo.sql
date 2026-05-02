-- =============================================================================
-- 003_seed_promo.sql — SKUs, pricing tiers, POS materials, plus Nick as director
-- Run AFTER 003_promo_calendar.sql
-- =============================================================================

DELETE FROM promo_trade_spend_lines;
DELETE FROM promo_sku_lines;
DELETE FROM promos_v2;
DELETE FROM pos_materials;
DELETE FROM pricing_tiers;
DELETE FROM skus;

-- Add Nick as director and promote Evan & JR
INSERT INTO profiles (id, email, full_name, role, sales_channel, sales_region) VALUES
  ('11111111-1111-1111-1111-aaaa00000020', 'nick@mitra-9.com', 'Nick Kemper', 'director', 'Conventional', NULL)
ON CONFLICT (id) DO UPDATE SET role='director';
UPDATE profiles SET role='director' WHERE email IN ('evan@mitra-9.com', 'jr@mitra-9.com');

-- SKUs
INSERT INTO skus (id, product_family, flavor, brand, active, sort_order) VALUES
  ('sku-001', 'Kratom Cans', 'Tangerine', 'Kratom', TRUE, 1),
  ('sku-002', 'Kratom Cans', 'Dragon Fruit', 'Kratom', TRUE, 2),
  ('sku-003', 'Kratom Cans', 'Cream Soda', 'Kratom', TRUE, 3),
  ('sku-004', 'Kratom Cans', 'Midnight Cola', 'Kratom', TRUE, 4),
  ('sku-005', 'Kratom Cans', 'Tropical', 'Kratom', TRUE, 5),
  ('sku-006', 'Kratom Cans', 'Root Beer', 'Kratom', TRUE, 6),
  ('sku-007', 'Kratom Cans', 'Raspberry Lime', 'Kratom', TRUE, 7),
  ('sku-008', 'Kratom Cans', 'Berry', 'Kratom', TRUE, 8),
  ('sku-009', 'Kratom Cans', 'Citrus Sun', 'Kratom', TRUE, 9),
  ('sku-010', 'Kratom Cans', 'Black Cherry', 'Kratom', TRUE, 10),
  ('sku-011', 'Kratom Cans', 'Watermelon', 'Kratom', TRUE, 11),
  ('sku-012', 'Kratom Cans', 'Bubbly Pop', 'Kratom', TRUE, 12),
  ('sku-013', 'Kratom Cans', 'Variety Pack', 'Kratom', TRUE, 13),
  ('sku-014', 'Kava Cans', 'Strawberry-Watermelon', 'Kava', TRUE, 14),
  ('sku-015', 'Kava Cans', 'Paradise Lychee', 'Kava', TRUE, 15),
  ('sku-016', 'Kava Cans', 'Orange Dreamsicle', 'Kava', TRUE, 16),
  ('sku-017', 'Kava Cans', 'Lemonade', 'Kava', TRUE, 17),
  ('sku-018', 'Kava Cans', 'Variety Pack', 'Kava', TRUE, 18),
  ('sku-019', 'Kratom Powder Sticks', 'Variety Pack', 'Kratom', TRUE, 19),
  ('sku-020', 'Kratom Powder Sticks', 'Tangerine', 'Kratom', TRUE, 20),
  ('sku-021', 'Kratom Powder Sticks', 'Raspberry Lime', 'Kratom', TRUE, 21),
  ('sku-022', 'Kratom Powder Sticks', 'Watermelon', 'Kratom', TRUE, 22),
  ('sku-023', 'Kratom Powder Sticks', 'Black Cherry', 'Kratom', TRUE, 23),
  ('sku-024', 'Kava Powder Sticks', 'Variety Pack', 'Kava', TRUE, 24),
  ('sku-025', 'Kava Powder Sticks', 'Island Punch', 'Kava', TRUE, 25),
  ('sku-026', 'Kava Powder Sticks', 'Orange Dreamsicle', 'Kava', TRUE, 26),
  ('sku-027', 'Kava Powder Sticks', 'Lemonade', 'Kava', TRUE, 27),
  ('sku-028', 'Kava Powder Sticks', 'Strawberry-Watermelon', 'Kava', TRUE, 28),
  ('sku-029', 'Draft Kegs', 'Kratom Extract', 'Kratom', TRUE, 29),
  ('sku-030', 'Draft Kegs', 'Dragon Fruit', 'Kratom', TRUE, 30),
  ('sku-031', 'Draft Kegs', 'Tangerine', 'Kratom', TRUE, 31),
  ('sku-032', 'Draft Kegs', 'Raspberry Lime', 'Kratom', TRUE, 32),
  ('sku-033', 'Draft Kegs', 'Lemonade', 'Kava', TRUE, 33),
  ('sku-034', 'Draft Kegs', 'Kava Extract', 'Kava', TRUE, 34),
  ('sku-035', 'Draft Kegs', 'Orange Dreamsicle', 'Kava', TRUE, 35),
  ('sku-036', 'Shots Combo Kava+Kratom', 'Purple Rush', 'Kratom', TRUE, 36),
  ('sku-037', 'Shots Combo Kava+Kratom', 'Crisp Apple', 'Kratom', TRUE, 37),
  ('sku-038', 'Shots Combo Kava+Kratom', 'Blue Razz', 'Kratom', TRUE, 38),
  ('sku-039', 'Shots Combo Kava+Kratom', 'Crimson Spark', 'Kratom', TRUE, 39),
  ('sku-040', 'Shots Combo Kava+Kratom', 'Fireshot', 'Kratom', TRUE, 40),
  ('sku-041', 'Shots Combo Kava+Kratom', 'Lavender Sunrise', 'Kratom', TRUE, 41),
  ('sku-042', 'Shots Combo Kava+Kratom', 'Cool Breeze', 'Kratom', TRUE, 42);

-- Pricing Tiers
INSERT INTO pricing_tiers (id, product_family, customer_class, order_min, order_max, price_per_case, price_per_unit, units_per_case, shipping_terms, cogs_per_unit, cogs_per_case, msrp, active) VALUES
  ('11111111-2222-3333-4444-000000000001', 'Kratom Cans', 'Retailer', 1, 3, 88, 3.67, 24, '$15/case', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000002', 'Kratom Cans', 'Retailer', 4, 11, 84, 3.5, 24, '$15/case', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000003', 'Kratom Cans', 'Retailer', 12, 24, 81, 3.38, 24, '$15/case', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000004', 'Kratom Cans', 'Retailer', 25, 96, 78, 3.25, 24, '$250/flat', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000005', 'Kratom Cans', 'Wholesaler', 97, 192, 70, 2.92, 24, 'Free', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000006', 'Kratom Cans', 'Wholesaler', 193, 384, 68, 2.83, 24, 'Free', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000007', 'Kratom Cans', 'Wholesaler', 385, 960, 66, 2.75, 24, 'Free', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000008', 'Kratom Cans', 'Distributor', 961, NULL, 62.4, 2.6, 24, 'Free', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000009', 'Kava Cans', 'Retailer', 1, 3, 88, 3.67, 24, '$15/case', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000010', 'Kava Cans', 'Retailer', 4, 11, 84, 3.5, 24, '$15/case', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000011', 'Kava Cans', 'Retailer', 12, 24, 81, 3.38, 24, '$15/case', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000012', 'Kava Cans', 'Retailer', 25, 96, 78, 3.25, 24, '$250/flat', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000013', 'Kava Cans', 'Wholesaler', 97, 192, 70, 2.92, 24, 'Free', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000014', 'Kava Cans', 'Wholesaler', 193, 384, 68, 2.83, 24, 'Free', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000015', 'Kava Cans', 'Wholesaler', 385, 960, 66, 2.75, 24, 'Free', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000016', 'Kava Cans', 'Distributor', 961, NULL, 62.4, 2.6, 24, 'Free', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000017', 'Shots Combo Kava+Kratom', 'Retailer', 1, 13, 540, 3.75, 144, '$15/box', 1.2, 172.8, 7.99, TRUE),
  ('11111111-2222-3333-4444-000000000018', 'Shots Combo Kava+Kratom', 'Wholesaler', 1, 13, 480, 3.33, 144, '$30/mastercase', 1.2, 172.8, 7.99, TRUE),
  ('11111111-2222-3333-4444-000000000019', 'Shots Combo Kava+Kratom', 'Wholesaler', 14, 55, 480, 3.33, 144, 'Free', 1.2, 172.8, 7.99, TRUE),
  ('11111111-2222-3333-4444-000000000020', 'Shots Combo Kava+Kratom', 'Distributor', 56, NULL, 408, 2.83, 144, 'Free', 1.2, 172.8, 7.99, TRUE),
  ('11111111-2222-3333-4444-000000000021', 'Shots Kratom Only', 'Retailer', 1, 13, 624, 4.33, 144, '$15/box', 1.2, 172.8, 8.99, TRUE),
  ('11111111-2222-3333-4444-000000000022', 'Shots Kratom Only', 'Wholesaler', 1, 13, 540, 3.75, 144, '$30/mastercase', 1.2, 172.8, 8.99, TRUE),
  ('11111111-2222-3333-4444-000000000023', 'Shots Kratom Only', 'Wholesaler', 14, 55, 540, 3.75, 144, 'Free', 1.2, 172.8, 8.99, TRUE),
  ('11111111-2222-3333-4444-000000000024', 'Shots Kratom Only', 'Distributor', 56, NULL, 468, 3.25, 144, 'Free', 1.2, 172.8, 8.99, TRUE),
  ('11111111-2222-3333-4444-000000000025', 'Shots Kava Only', 'Retailer', 1, 13, 432, 3.0, 144, '$15/box', 1.2, 172.8, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000026', 'Shots Kava Only', 'Wholesaler', 1, 13, 396, 2.75, 144, '$30/mastercase', 1.2, 172.8, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000027', 'Shots Kava Only', 'Wholesaler', 14, 55, 396, 2.75, 144, 'Free', 1.2, 172.8, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000028', 'Shots Kava Only', 'Distributor', 56, NULL, 348, 2.42, 144, 'Free', 1.2, 172.8, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000029', 'Kratom Powder Sticks', 'Retailer', 1, 3, 120, 3.0, 40, '$20/flat', 0.4, 16.0, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000030', 'Kratom Powder Sticks', 'Retailer', 4, 9, 120, 3.0, 40, '$10/flat', 0.4, 16.0, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000031', 'Kratom Powder Sticks', 'Wholesaler', 10, 19, 96, 2.4, 40, 'Free', 0.4, 16.0, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000032', 'Kratom Powder Sticks', 'Distributor', 20, NULL, 88, 2.2, 40, 'Free', 0.4, 16.0, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000033', 'Kava Powder Sticks', 'Retailer', 1, 3, 120, 3.0, 40, '$20/flat', 0.4, 16.0, 3.99, TRUE),
  ('11111111-2222-3333-4444-000000000034', 'Kava Powder Sticks', 'Retailer', 4, 9, 120, 3.0, 40, '$10/flat', 0.4, 16.0, 3.99, TRUE),
  ('11111111-2222-3333-4444-000000000035', 'Kava Powder Sticks', 'Wholesaler', 10, 19, 96, 2.4, 40, 'Free', 0.4, 16.0, 3.99, TRUE),
  ('11111111-2222-3333-4444-000000000036', 'Kava Powder Sticks', 'Distributor', 20, NULL, 88, 2.2, 40, 'Free', 0.4, 16.0, 3.99, TRUE),
  ('11111111-2222-3333-4444-000000000037', 'Draft Kegs', 'Retailer', 1, 19, 150, 2.73, 55, '$30/keg', 18.0, 990.0, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000038', 'Draft Kegs', 'Wholesaler', 20, 39, 135, 2.45, 55, '$300/flat', 18.0, 990.0, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000039', 'Draft Kegs', 'Distributor', 40, NULL, 120, 2.18, 55, 'Free', 18.0, 990.0, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000040', 'Kratom Cans', 'eComm Everyday', 1, NULL, 143.76, 5.99, 24, 'Variable', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000041', 'Kratom Cans', 'eComm Promoted', 1, NULL, 129.36, 5.39, 24, 'Variable', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000042', 'Kratom Cans', 'eComm Deep Promo', 1, NULL, 120.0, 5.0, 24, 'Variable', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000043', 'Kratom Cans', 'Retail Direct Everyday', 1, NULL, 143.76, 5.99, 24, 'Variable', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000044', 'Kratom Cans', 'Retail Direct Promoted', 1, NULL, 132.0, 5.5, 24, 'Variable', 0.89, 21.36, 5.99, TRUE),
  ('11111111-2222-3333-4444-000000000045', 'Kratom Cans', 'Retail Direct Deep Promo', 1, NULL, 120.0, 5.0, 24, 'Variable', 0.89, 21.36, 5.99, TRUE);

-- POS Materials
INSERT INTO pos_materials (id, name, category, cost_per_unit, unit_label, description, active, sort_order) VALUES
  ('22222222-3333-4444-5555-000000000001', 'Case Stacker', 'Display', 85.0, 'each', 'Floor display, holds ~24 cases', TRUE, 1),
  ('22222222-3333-4444-5555-000000000002', 'Acrylic Sign', 'Signage', 42.0, 'each', 'Branded acrylic display signage', TRUE, 2),
  ('22222222-3333-4444-5555-000000000003', 'Shelf Talker', 'Signage', 3.5, 'each', 'Small shelf-edge call-out card', TRUE, 3),
  ('22222222-3333-4444-5555-000000000004', 'End Cap Kit', 'Display', 320.0, 'set', 'End-cap promotional kit with header + side cards', TRUE, 4),
  ('22222222-3333-4444-5555-000000000005', 'Cooler Wrap', 'Cooler', 450.0, 'each', 'Branded cooler door wrap', TRUE, 5),
  ('22222222-3333-4444-5555-000000000006', 'Branded Cooler', 'Cooler', 1850.0, 'each', 'Stand-alone branded refrigerated unit', TRUE, 6),
  ('22222222-3333-4444-5555-000000000007', 'Floor Decal', 'Signage', 18.0, 'each', 'Branded floor cling for in-store traffic', TRUE, 7),
  ('22222222-3333-4444-5555-000000000008', 'Counter Mat', 'Premium', 28.0, 'each', 'Branded counter mat for c-store checkout', TRUE, 8),
  ('22222222-3333-4444-5555-000000000009', 'Branded T-shirt', 'Premium', 12.0, 'each', 'For demo staff', TRUE, 9),
  ('22222222-3333-4444-5555-000000000010', 'Custom Display Bin', 'Display', 145.0, 'each', 'Themed seasonal display', TRUE, 10);