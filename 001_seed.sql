-- =============================================================================
-- Mitra-9 Sales Planning & Operations Tool
-- Seed Data
-- =============================================================================
-- Run AFTER 001_initial_schema.sql.
--
-- This seed file creates sample data for demo purposes. Because the profiles
-- table references auth.users, you must first create the corresponding auth
-- users. Two options:
--
--   A. MANUAL (recommended for real Supabase projects):
--      Create each user via the Supabase dashboard (Authentication → Users),
--      then update the UUID constants below to match the IDs you get.
--
--   B. LOCAL DEV:
--      Run the seed script at `supabase/seed/create_auth_users.js` which uses
--      the service-role key to create the auth users with these exact IDs,
--      then run this SQL.
--
-- =============================================================================

-- Fixed UUIDs for seed users so the FKs line up deterministically.
-- (These must match the auth.users rows created by the companion JS script.)

insert into public.profiles (id, full_name, role, sales_channel, sales_region, email) values
  ('11111111-1111-1111-1111-111111111001', 'Todd Allison',      'manager', null,                 null,       'todd@mitra9.example'),
  ('11111111-1111-1111-1111-111111111002', 'Albert Martinez',   'manager', null,                 null,       'albert@mitra9.example'),
  ('11111111-1111-1111-1111-111111111003', 'Evan Beard',        'rep',     'New Distribution',   null,       'evan@mitra9.example'),
  ('11111111-1111-1111-1111-111111111004', 'Alissa Shupperd',   'rep',     'Inbound',            null,       'alissa@mitra9.example'),
  ('11111111-1111-1111-1111-111111111005', 'Noah Smith',        'rep',     'Wholesale',          null,       'noah@mitra9.example'),
  ('11111111-1111-1111-1111-111111111006', 'Joe Sanders',       'rep',     'Chains',             null,       'joe@mitra9.example'),
  ('11111111-1111-1111-1111-111111111007', 'JR Hernandez',      'manager', null,                 null,       'jr@mitra9.example'),
  ('11111111-1111-1111-1111-111111111008', 'Nick Kemper',       'rep',     'New Distribution',   null,       'nick@mitra9.example'),
  ('11111111-1111-1111-1111-111111111009', 'Emily Hill',        'viewer',  null,                 null,       'emily@mitra9.example'),
  ('11111111-1111-1111-1111-11111111100a', 'Luis Escobar',      'rep',     'Conventional',       'Florida',  'luis@mitra9.example')
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  sales_channel = excluded.sales_channel,
  sales_region = excluded.sales_region,
  email = excluded.email;

-- =============================================================================
-- ANNUAL PLAN — FY2026, ~$25M distributed across 12 months & 6 channels
-- Q1 ~$6.3M scaling up through Q4.
-- =============================================================================
insert into public.annual_plan (fiscal_year, month, sales_channel, planned_revenue, planned_units) values
  -- Jan
  (2026, 1,  'Conventional',     820000,  68000),
  (2026, 1,  'New Distribution', 300000,  25000),
  (2026, 1,  'Wholesale',        300000,  25000),
  (2026, 1,  'Chains',           200000,  16000),
  (2026, 1,  'Inbound',          200000,  16000),
  (2026, 1,  'B2C',              180000,  14000),
  -- Feb
  (2026, 2,  'Conventional',     840000,  70000),
  (2026, 2,  'New Distribution', 315000,  26000),
  (2026, 2,  'Wholesale',        315000,  26000),
  (2026, 2,  'Chains',           210000,  17000),
  (2026, 2,  'Inbound',          210000,  17000),
  (2026, 2,  'B2C',              190000,  15000),
  -- Mar
  (2026, 3,  'Conventional',     880000,  73000),
  (2026, 3,  'New Distribution', 330000,  27500),
  (2026, 3,  'Wholesale',        330000,  27500),
  (2026, 3,  'Chains',           220000,  18000),
  (2026, 3,  'Inbound',          220000,  18000),
  (2026, 3,  'B2C',              200000,  16000),
  -- Apr (current month)
  (2026, 4,  'Conventional',     920000,  76000),
  (2026, 4,  'New Distribution', 345000,  28500),
  (2026, 4,  'Wholesale',        345000,  28500),
  (2026, 4,  'Chains',           230000,  19000),
  (2026, 4,  'Inbound',          230000,  19000),
  (2026, 4,  'B2C',              210000,  17000),
  -- May
  (2026, 5,  'Conventional',     950000,  79000),
  (2026, 5,  'New Distribution', 360000,  30000),
  (2026, 5,  'Wholesale',        360000,  30000),
  (2026, 5,  'Chains',           240000,  20000),
  (2026, 5,  'Inbound',          240000,  20000),
  (2026, 5,  'B2C',              220000,  18000),
  -- Jun
  (2026, 6,  'Conventional',     980000,  81500),
  (2026, 6,  'New Distribution', 370000,  31000),
  (2026, 6,  'Wholesale',        370000,  31000),
  (2026, 6,  'Chains',           245000,  20500),
  (2026, 6,  'Inbound',          245000,  20500),
  (2026, 6,  'B2C',              225000,  18500),
  -- Jul (4th of July)
  (2026, 7,  'Conventional',    1050000,  87000),
  (2026, 7,  'New Distribution', 400000,  33500),
  (2026, 7,  'Wholesale',        400000,  33500),
  (2026, 7,  'Chains',           260000,  21500),
  (2026, 7,  'Inbound',          260000,  21500),
  (2026, 7,  'B2C',              240000,  20000),
  -- Aug
  (2026, 8,  'Conventional',     980000,  81500),
  (2026, 8,  'New Distribution', 370000,  31000),
  (2026, 8,  'Wholesale',        370000,  31000),
  (2026, 8,  'Chains',           245000,  20500),
  (2026, 8,  'Inbound',          245000,  20500),
  (2026, 8,  'B2C',              225000,  18500),
  -- Sep
  (2026, 9,  'Conventional',    1020000,  85000),
  (2026, 9,  'New Distribution', 385000,  32000),
  (2026, 9,  'Wholesale',        385000,  32000),
  (2026, 9,  'Chains',           255000,  21000),
  (2026, 9,  'Inbound',          255000,  21000),
  (2026, 9,  'B2C',              235000,  19500),
  -- Oct
  (2026, 10, 'Conventional',    1080000,  89500),
  (2026, 10, 'New Distribution', 405000,  33500),
  (2026, 10, 'Wholesale',        405000,  33500),
  (2026, 10, 'Chains',           270000,  22500),
  (2026, 10, 'Inbound',          270000,  22500),
  (2026, 10, 'B2C',              245000,  20500),
  -- Nov
  (2026, 11, 'Conventional',    1100000,  91500),
  (2026, 11, 'New Distribution', 415000,  34500),
  (2026, 11, 'Wholesale',        415000,  34500),
  (2026, 11, 'Chains',           275000,  23000),
  (2026, 11, 'Inbound',          275000,  23000),
  (2026, 11, 'B2C',              250000,  21000),
  -- Dec
  (2026, 12, 'Conventional',    1180000,  98000),
  (2026, 12, 'New Distribution', 445000,  37000),
  (2026, 12, 'Wholesale',        445000,  37000),
  (2026, 12, 'Chains',           295000,  24500),
  (2026, 12, 'Inbound',          295000,  24500),
  (2026, 12, 'B2C',              265000,  22000)
on conflict (fiscal_year, month, sales_channel) do nothing;

-- =============================================================================
-- FORECAST ENTRIES — sample April forecasts from a few reps
-- =============================================================================
insert into public.forecast_entries
  (fiscal_year, month, submitted_by, sales_channel, customer_name, product_category, sku, forecasted_revenue, forecasted_units, confidence, notes, status, submitted_at)
values
  -- Evan (New Distribution)
  (2026, 4, '11111111-1111-1111-1111-111111111003', 'New Distribution', 'SouthCo Beverage Group', 'Shots',    'KS-12OZ-OG', 145000, 12000, 'high',   'Pipeline closed, PO received.', 'submitted', now() - interval '2 days'),
  (2026, 4, '11111111-1111-1111-1111-111111111003', 'New Distribution', 'Rocky Mountain Distributing', 'Shots', 'KS-12OZ-OG', 95000,  8000,  'medium', 'Awaiting final contract signature.', 'submitted', now() - interval '2 days'),
  (2026, 4, '11111111-1111-1111-1111-111111111003', 'New Distribution', 'Atlantic Trade Partners', 'Seltzers', 'SZ-12OZ-LIM', 60000, 5000, 'low', 'Still in discovery, may slip.', 'draft', null),
  -- Noah (Wholesale)
  (2026, 4, '11111111-1111-1111-1111-111111111005', 'Wholesale', 'KeHE Distributors',       'Shots',    'KS-12OZ-OG',  180000, 15000, 'high',   'Reorder pattern looks strong.', 'approved', now() - interval '4 days'),
  (2026, 4, '11111111-1111-1111-1111-111111111005', 'Wholesale', 'UNFI',                    'Seltzers', 'SZ-12OZ-LIM',  95000,  7800,  'medium', 'New SKUs on shelf end of month.', 'submitted', now() - interval '1 day'),
  (2026, 4, '11111111-1111-1111-1111-111111111005', 'Wholesale', 'DPI Specialty Foods',     'Sticks',   'DP-STK-OG',    55000,  22000, 'high',   null, 'submitted', now() - interval '1 day'),
  -- Joe (Chains)
  (2026, 4, '11111111-1111-1111-1111-111111111006', 'Chains',    'Sprouts Farmers Market',  'Shots',    'KS-12OZ-OG',   95000,  7900,  'high',   'Promotion active, expect lift.', 'approved', now() - interval '5 days'),
  (2026, 4, '11111111-1111-1111-1111-111111111006', 'Chains',    'Erewhon',                 'Seltzers', 'SZ-12OZ-LIM',  42000,  3500,  'high',   null, 'approved', now() - interval '5 days'),
  (2026, 4, '11111111-1111-1111-1111-111111111006', 'Chains',    'Fresh Thyme',             'Shots',    'KS-12OZ-OG',   65000,  5400,  'medium', 'New chain, first month in.', 'draft', null),
  -- Alissa (Inbound)
  (2026, 4, '11111111-1111-1111-1111-111111111004', 'Inbound',   'Inbound web leads Q2 batch', 'Shots', 'KS-12OZ-OG',  130000, 10800, 'medium', 'Lead volume trending to plan.', 'submitted', now() - interval '3 days'),
  (2026, 4, '11111111-1111-1111-1111-111111111004', 'Inbound',   'Inbound web leads Q2 batch', 'Kegs',  'DK-5GAL',      45000,  150,   'low',    'Kegs slower to close, long sales cycle.', 'submitted', now() - interval '3 days'),
  -- Luis (Conventional/Florida)
  (2026, 4, '11111111-1111-1111-1111-11111111100a', 'Conventional', 'Zuma Distribution',     'Shots',    'KS-12OZ-OG',  125000, 10400, 'medium', 'Red Tag concerns at several accounts.', 'draft', null),
  (2026, 4, '11111111-1111-1111-1111-11111111100a', 'Conventional', 'Humboldt Beverage',     'Shots',    'KS-12OZ-OG',  48000,  4000,  'low',    'Underperforming — RO item open.', 'draft', null);

-- =============================================================================
-- BRIDGE BUCKETS — sample Q2 plan-to-actuals drivers
-- =============================================================================
insert into public.bridge_buckets
  (fiscal_year, period_type, period_value, bucket_name, dollar_impact, units_impact, commentary, sort_order)
values
  (2026, 'quarter', 2, 'West Red Tag',             -252000, -21000, 'Humboldt, Sacani, Beauchamp, Guardian all under plan. RO item open with Luis.', 1),
  (2026, 'quarter', 2, 'Distributor Partners — Under', -1300000, -108000, 'Partners below 80% target. Nick managing recovery plan.', 2),
  (2026, 'quarter', 2, 'Go Gets Not Materialized', -668000, -55000, 'Pipeline slipped from Q1, re-baselined.', 3),
  (2026, 'quarter', 2, 'Open Orders',               -145000, -12000, 'Orders placed but not yet shipped end-of-period.', 4),
  (2026, 'quarter', 2, '4th of July Program (partial)', 150000, 12500, 'Pre-sell beginning in June.', 5),
  (2026, 'quarter', 2, 'New Distribution Pipeline', 109000,  9000,  'Evan''s three closed deals this quarter.', 6),
  (2026, 'quarter', 2, 'Other',                     -50000,  -4000, 'Minor miscellaneous variances.', 7);

-- =============================================================================
-- R&O ITEMS
-- =============================================================================
insert into public.ro_items
  (item_type, description, sales_channel, owner, owner_name, impact_low, impact_mid, impact_high, probability, classification, status, next_steps, due_date)
values
  ('risk',        'West Red Tag underperformance — Humboldt, Sacani, Beauchamp, Guardian', 'Conventional', '11111111-1111-1111-1111-11111111100a', 'Luis Escobar',   -280000, -252000, -200000, 0.85, 'base',        'open',        'Luis visiting top 4 accounts next week. Recovery plan due Monday.', (current_date + interval '7 days')::date),
  ('risk',        'Distributor partners below 80% target',                                  'New Distribution', '11111111-1111-1111-1111-111111111008', 'Nick Kemper',   -1400000, -1300000, -1100000, 0.75, 'base',        'in_progress', 'Weekly check-ins initiated. Reviewing 3 partner-level action plans.', (current_date + interval '14 days')::date),
  ('risk',        'Go Gets not materialized',                                               null, null, 'Team',           -750000, -668000, -500000, 0.60, 'incremental', 'open',        'Re-baseline pipeline. JR/Todd reviewing deal-level probability.', (current_date + interval '21 days')::date),
  ('opportunity', '4th of July promotional program',                                        null, '11111111-1111-1111-1111-111111111001', 'Todd Allison',   550000,  625000,  700000,  0.80, 'incremental', 'in_progress', 'Creative brief in progress, distributor pricing notices due May 1.', (current_date + interval '45 days')::date),
  ('opportunity', 'New Distribution pipeline — Evan deals',                                 'New Distribution', '11111111-1111-1111-1111-111111111003', 'Evan Beard',      90000, 109000,  140000,  0.90, 'base',        'in_progress', 'Three deals in contract review.', (current_date + interval '10 days')::date),
  ('opportunity', 'Mega Can / new format launch',                                           null, '11111111-1111-1111-1111-111111111007', 'JR Hernandez',   200000, 400000,  800000,  0.35, 'incremental', 'open',        'Emily sourcing co-packer. Go/no-go decision mid-Q3.', (current_date + interval '60 days')::date),
  ('opportunity', 'Sprouts incremental shelf position',                                     'Chains', '11111111-1111-1111-1111-111111111006', 'Joe Sanders',     40000,  75000,  120000, 0.55, 'incremental', 'open',        'Buyer meeting scheduled for next Tuesday.', (current_date + interval '5 days')::date),
  ('risk',        'Open orders aging past 30 days',                                         'Wholesale', '11111111-1111-1111-1111-111111111005', 'Noah Smith',     -180000, -145000, -100000, 0.50, 'base', 'in_progress', 'Ops working through credit holds.', (current_date + interval '7 days')::date);

-- =============================================================================
-- INITIATIVES
-- =============================================================================
insert into public.initiatives
  (name, description, owner, owner_name, sales_channel, stage, revenue_potential, ops_difficulty, strategic_alignment, time_to_execute, required_investment, dependencies, confidence_level, confidential)
values
  ('Mega Can Launch',          'New 16oz can format for convenience and c-store channel', '11111111-1111-1111-1111-111111111007', 'JR Hernandez', null, 'evaluating',     800000, 4, 5, 'Q3 2026', 180000, 'Co-packer capacity, label FDA clearance', 'medium', false),
  ('Mid-Content Shot Line',    'Lower-potency daily format for mass retail acceptance',  '11111111-1111-1111-1111-111111111007', 'JR Hernandez', null, 'idea',         450000, 3, 4, 'Q4 2026', 120000, 'R&D formulation', 'medium', false),
  ('Resealable Can',           'Larger resealable format for on-premise',                '11111111-1111-1111-1111-111111111007', 'JR Hernandez', null, 'idea',         300000, 4, 3, 'Q1 2027',  80000, 'Tooling lead time', 'low', false),
  ('White Label Program',      'White-label strategy for strategic distributor partners','11111111-1111-1111-1111-111111111001', 'Todd Allison', null, 'evaluating',    1200000, 5, 5, 'Q4 2026', 250000, 'Legal review, customer commitment', 'medium', true),
  ('4th of July Activation',   'National promo with tentpole merchandising',             '11111111-1111-1111-1111-111111111001', 'Todd Allison', null, 'approved',       625000, 2, 4, 'July',     35000, 'POS materials procurement', 'high', false),
  ('Distributor Scorecard 2.0','Structured partner-level scorecards and QBRs',           '11111111-1111-1111-1111-111111111008', 'Nick Kemper',  null, 'in_execution',   250000, 2, 4, 'Q2 2026',   5000, null, 'high', false),
  ('Sprouts Expansion',        'Add 3 SKUs at Sprouts nationally',                       '11111111-1111-1111-1111-111111111006', 'Joe Sanders',  'Chains', 'approved',  180000, 3, 3, 'Q2 2026',  20000, 'Shelf reset timing', 'medium', false);

-- =============================================================================
-- SCORING WEIGHTS (defaults per spec)
-- =============================================================================
insert into public.scoring_weights (criterion, weight) values
  ('revenue_potential',     3.0),
  ('ops_difficulty',        2.5),
  ('strategic_alignment',   2.0),
  ('time_to_execute',       1.5),
  ('required_investment',   1.0)
on conflict (criterion) do nothing;

-- =============================================================================
-- PROMOS
-- =============================================================================
insert into public.promos
  (name, start_date, end_date, channels, regions, target_revenue, pricing_mechanics, materials_needed, distributor_requirements, status, owner, owner_name)
values
  ('4th of July Program',
   '2026-07-01', '2026-07-07',
   array['Conventional', 'New Distribution', 'Wholesale', 'Chains'],
   array['Florida', 'West', 'North'],
   650000,
   '2 for $10 suggested SRP',
   '{"case_stackers": 100, "acrylics": 200, "shelf_talkers": 500}'::jsonb,
   '60-day pricing notice to distributors; feature ads in week 27',
   'planning',
   '11111111-1111-1111-1111-111111111001', 'Todd Allison'),
  ('Memorial Day Kickoff',
   '2026-05-22', '2026-05-29',
   array['Chains', 'Conventional'],
   array['Florida', 'West'],
   220000,
   'BOGO 50% off at Sprouts, $4.99 SRP elsewhere',
   '{"case_stackers": 40, "acrylics": 80}'::jsonb,
   '30-day notice to chain partners',
   'planning',
   '11111111-1111-1111-1111-111111111006', 'Joe Sanders'),
  ('Spring Seltzer Launch',
   '2026-04-15', '2026-04-30',
   array['Chains', 'Wholesale'],
   array['Florida', 'West', 'North'],
   150000,
   'Intro pricing $3.99 SRP',
   '{"shelf_talkers": 300, "end_cap_kits": 20}'::jsonb,
   'New item setup complete with top 5 chains',
   'active',
   '11111111-1111-1111-1111-111111111007', 'JR Hernandez');

-- =============================================================================
-- DISTRIBUTOR TARGETS — sample April targets
-- =============================================================================
insert into public.distributor_targets
  (fiscal_year, month, distributor_name, target_revenue, sales_region)
values
  (2026, 4, 'SouthCo Beverage Group',       145000, 'South'),
  (2026, 4, 'Rocky Mountain Distributing',   95000, 'West'),
  (2026, 4, 'Atlantic Trade Partners',       60000, 'East'),
  (2026, 4, 'Humboldt Beverage',             55000, 'West'),
  (2026, 4, 'Zuma Distribution',            125000, 'Florida'),
  (2026, 4, 'Sacani Distributors',           40000, 'West'),
  (2026, 4, 'Beauchamp Beverage',            35000, 'West'),
  (2026, 4, 'Guardian Beverage',             45000, 'West')
on conflict (fiscal_year, month, distributor_name) do nothing;

-- =============================================================================
-- MISS IMPACT ASSUMPTIONS
-- =============================================================================
insert into public.miss_impact_assumptions (assumption_key, assumption_value, description) values
  ('sku_substitution_rate',     0.35,  'Portion of delayed volume that draws down other SKU inventory'),
  ('substitution_recovery_rate',0.50,  'Portion of substituted volume that is later backfilled'),
  ('momentum_drag_m1',          0.10,  'Month 1 trailing shelf-presence drag'),
  ('momentum_drag_m2',          0.15,  'Month 2 trailing shelf-presence drag'),
  ('momentum_drag_m3',          0.08,  'Month 3 trailing shelf-presence drag'),
  ('cancellation_rate',         0.12,  'Portion of delayed orders that are outright cancelled'),
  ('cost_of_capital_annual',    0.10,  'Annualized cost of capital'),
  ('affected_stores_pct',       0.25,  'Share of retail doors affected by a single miss event'),
  ('revenue_per_affected_store',2500,  'Average monthly revenue per affected store'),
  ('total_retail_doors',        800,   'Total retail doors in ACV')
on conflict (assumption_key) do nothing;
