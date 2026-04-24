/**
 * Mock data store. Holds all user-generated data (forecasts, R&O items,
 * initiatives, promos, bridge buckets, etc.) in memory with simple
 * CRUD + subscription helpers. Mirrors the subset of the Supabase API
 * the UI actually uses so swapping to real Supabase is mechanical.
 *
 * Demo data matches the seed in supabase/seed/001_seed.sql.
 */

import { MOCK_USERS } from './mockUsers'

// --- tiny id + uuid helpers ---
function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function now() { return new Date().toISOString() }
function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// -----------------------------------------------------------------------------
// Initial seed (mirrors supabase/seed/001_seed.sql)
// -----------------------------------------------------------------------------

const CHANNELS = ['Conventional', 'New Distribution', 'Wholesale', 'Chains', 'Inbound', 'B2C']

function buildAnnualPlan() {
  const plan = {
    1:  [820000, 300000, 300000, 200000, 200000, 180000],
    2:  [840000, 315000, 315000, 210000, 210000, 190000],
    3:  [880000, 330000, 330000, 220000, 220000, 200000],
    4:  [920000, 345000, 345000, 230000, 230000, 210000],
    5:  [950000, 360000, 360000, 240000, 240000, 220000],
    6:  [980000, 370000, 370000, 245000, 245000, 225000],
    7: [1050000, 400000, 400000, 260000, 260000, 240000],
    8:  [980000, 370000, 370000, 245000, 245000, 225000],
    9: [1020000, 385000, 385000, 255000, 255000, 235000],
    10:[1080000, 405000, 405000, 270000, 270000, 245000],
    11:[1100000, 415000, 415000, 275000, 275000, 250000],
    12:[1180000, 445000, 445000, 295000, 295000, 265000],
  }
  const rows = []
  for (const [m, revs] of Object.entries(plan)) {
    CHANNELS.forEach((ch, i) => {
      rows.push({
        id: uid(),
        fiscal_year: 2026,
        month: parseInt(m, 10),
        sales_channel: ch,
        planned_revenue: revs[i],
        planned_units: Math.round(revs[i] / 12),
        updated_at: now(),
      })
    })
  }
  return rows
}

const seed = {
  profiles: MOCK_USERS.map((u) => ({ ...u, created_at: now() })),

  annual_plan: buildAnnualPlan(),

  forecast_entries: [
    // Evan
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111003', sales_channel: 'New Distribution', customer_name: 'SouthCo Beverage Group',     product_category: 'Shots',    sku: 'KS-12OZ-OG', forecasted_revenue: 145000, forecasted_units: 12000, confidence: 'high',   notes: 'Pipeline closed, PO received.',               status: 'submitted', submitted_at: now(), created_at: now(), updated_at: now() },
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111003', sales_channel: 'New Distribution', customer_name: 'Rocky Mountain Distributing', product_category: 'Shots',    sku: 'KS-12OZ-OG', forecasted_revenue: 95000,  forecasted_units: 8000,  confidence: 'medium', notes: 'Awaiting final contract signature.',          status: 'submitted', submitted_at: now(), created_at: now(), updated_at: now() },
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111003', sales_channel: 'New Distribution', customer_name: 'Atlantic Trade Partners',     product_category: 'Seltzers', sku: 'SZ-12OZ-LIM', forecasted_revenue: 60000, forecasted_units: 5000,  confidence: 'low',    notes: 'Still in discovery, may slip.',               status: 'draft',     submitted_at: null,  created_at: now(), updated_at: now() },
    // Noah
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111005', sales_channel: 'Wholesale', customer_name: 'KeHE Distributors', product_category: 'Shots',    sku: 'KS-12OZ-OG',  forecasted_revenue: 180000, forecasted_units: 15000, confidence: 'high',   notes: 'Reorder pattern looks strong.',  status: 'approved',  submitted_at: now(), created_at: now(), updated_at: now() },
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111005', sales_channel: 'Wholesale', customer_name: 'UNFI',              product_category: 'Seltzers', sku: 'SZ-12OZ-LIM', forecasted_revenue: 95000,  forecasted_units: 7800,  confidence: 'medium', notes: 'New SKUs on shelf end of month.', status: 'submitted', submitted_at: now(), created_at: now(), updated_at: now() },
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111005', sales_channel: 'Wholesale', customer_name: 'DPI Specialty Foods', product_category: 'Sticks', sku: 'DP-STK-OG', forecasted_revenue: 55000, forecasted_units: 22000, confidence: 'high', notes: null, status: 'submitted', submitted_at: now(), created_at: now(), updated_at: now() },
    // Joe
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111006', sales_channel: 'Chains', customer_name: 'Sprouts Farmers Market', product_category: 'Shots',    sku: 'KS-12OZ-OG',  forecasted_revenue: 95000, forecasted_units: 7900, confidence: 'high',   notes: 'Promotion active, expect lift.', status: 'approved',  submitted_at: now(), created_at: now(), updated_at: now() },
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111006', sales_channel: 'Chains', customer_name: 'Erewhon',                product_category: 'Seltzers', sku: 'SZ-12OZ-LIM', forecasted_revenue: 42000, forecasted_units: 3500, confidence: 'high',   notes: null, status: 'approved',  submitted_at: now(), created_at: now(), updated_at: now() },
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111006', sales_channel: 'Chains', customer_name: 'Fresh Thyme',            product_category: 'Shots',    sku: 'KS-12OZ-OG',  forecasted_revenue: 65000, forecasted_units: 5400, confidence: 'medium', notes: 'New chain, first month in.', status: 'draft', submitted_at: null, created_at: now(), updated_at: now() },
    // Alissa
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111004', sales_channel: 'Inbound', customer_name: 'Inbound web leads Q2 batch', product_category: 'Shots', sku: 'KS-12OZ-OG', forecasted_revenue: 130000, forecasted_units: 10800, confidence: 'medium', notes: 'Lead volume trending to plan.', status: 'submitted', submitted_at: now(), created_at: now(), updated_at: now() },
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-111111111004', sales_channel: 'Inbound', customer_name: 'Inbound web leads Q2 batch', product_category: 'Kegs',  sku: 'DK-5GAL',    forecasted_revenue: 45000,  forecasted_units: 150,   confidence: 'low',    notes: 'Kegs slower to close.', status: 'submitted', submitted_at: now(), created_at: now(), updated_at: now() },
    // Luis
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-11111111100a', sales_channel: 'Conventional', customer_name: 'Zuma Distribution', product_category: 'Shots', sku: 'KS-12OZ-OG', forecasted_revenue: 125000, forecasted_units: 10400, confidence: 'medium', notes: 'Red Tag concerns at several accounts.', status: 'draft', submitted_at: null, created_at: now(), updated_at: now() },
    { id: uid(), fiscal_year: 2026, month: 4, submitted_by: '11111111-1111-1111-1111-11111111100a', sales_channel: 'Conventional', customer_name: 'Humboldt Beverage',  product_category: 'Shots', sku: 'KS-12OZ-OG', forecasted_revenue: 48000,  forecasted_units: 4000,  confidence: 'low',    notes: 'Underperforming — RO item open.',      status: 'draft', submitted_at: null, created_at: now(), updated_at: now() },
  ],

  bridge_buckets: [
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'West Red Tag',                     dollar_impact: -252000,  units_impact: -21000,  commentary: 'Humboldt, Sacani, Beauchamp, Guardian all under plan. RO item open with Luis.', sort_order: 1, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'Distributor Partners — Under',     dollar_impact: -1300000, units_impact: -108000, commentary: 'Partners below 80% target. Nick managing recovery plan.',                      sort_order: 2, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'Go Gets Not Materialized',         dollar_impact: -668000,  units_impact: -55000,  commentary: 'Pipeline slipped from Q1, re-baselined.',                                       sort_order: 3, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'Open Orders',                       dollar_impact: -145000,  units_impact: -12000,  commentary: 'Orders placed but not yet shipped end-of-period.',                              sort_order: 4, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: '4th of July Program (partial)',    dollar_impact: 150000,   units_impact: 12500,   commentary: 'Pre-sell beginning in June.',                                                   sort_order: 5, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'New Distribution Pipeline',        dollar_impact: 109000,   units_impact: 9000,    commentary: 'Evan\'s three closed deals this quarter.',                                      sort_order: 6, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'Other',                              dollar_impact: -50000,   units_impact: -4000,   commentary: 'Minor miscellaneous variances.',                                                sort_order: 7, updated_at: now() },
  ],

  ro_items: [
    { id: uid(), item_type: 'risk',        description: 'West Red Tag underperformance — Humboldt, Sacani, Beauchamp, Guardian', sales_channel: 'Conventional',     owner: '11111111-1111-1111-1111-11111111100a', owner_name: 'Luis Escobar',   impact_low: -280000, impact_mid: -252000, impact_high: -200000, probability: 0.85, classification: 'base',        status: 'open',        next_steps: 'Luis visiting top 4 accounts next week. Recovery plan due Monday.',         due_date: daysFromNow(7),  created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'risk',        description: 'Distributor partners below 80% target',                                  sales_channel: 'New Distribution', owner: '11111111-1111-1111-1111-111111111008', owner_name: 'Nick Kemper',    impact_low: -1400000, impact_mid: -1300000, impact_high: -1100000, probability: 0.75, classification: 'base',        status: 'in_progress', next_steps: 'Weekly check-ins initiated. Reviewing 3 partner-level action plans.',       due_date: daysFromNow(14), created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'risk',        description: 'Go Gets not materialized',                                              sales_channel: null,                owner: null,                                      owner_name: 'Team',          impact_low: -750000, impact_mid: -668000, impact_high: -500000, probability: 0.60, classification: 'incremental', status: 'open',        next_steps: 'Re-baseline pipeline. JR/Todd reviewing deal-level probability.',             due_date: daysFromNow(21), created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'opportunity', description: '4th of July promotional program',                                       sales_channel: null,                owner: '11111111-1111-1111-1111-111111111001', owner_name: 'Todd Allison',  impact_low: 550000,  impact_mid: 625000,  impact_high: 700000,  probability: 0.80, classification: 'incremental', status: 'in_progress', next_steps: 'Creative brief in progress, distributor pricing notices due May 1.',          due_date: daysFromNow(45), created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'opportunity', description: 'New Distribution pipeline — Evan deals',                                sales_channel: 'New Distribution', owner: '11111111-1111-1111-1111-111111111003', owner_name: 'Evan Beard',     impact_low: 90000,   impact_mid: 109000,  impact_high: 140000,  probability: 0.90, classification: 'base',        status: 'in_progress', next_steps: 'Three deals in contract review.',                                             due_date: daysFromNow(10), created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'opportunity', description: 'Mega Can / new format launch',                                          sales_channel: null,                owner: '11111111-1111-1111-1111-111111111007', owner_name: 'JR Hernandez',   impact_low: 200000,  impact_mid: 400000,  impact_high: 800000,  probability: 0.35, classification: 'incremental', status: 'open',        next_steps: 'Emily sourcing co-packer. Go/no-go decision mid-Q3.',                        due_date: daysFromNow(60), created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'opportunity', description: 'Sprouts incremental shelf position',                                    sales_channel: 'Chains',            owner: '11111111-1111-1111-1111-111111111006', owner_name: 'Joe Sanders',    impact_low: 40000,   impact_mid: 75000,   impact_high: 120000,  probability: 0.55, classification: 'incremental', status: 'open',        next_steps: 'Buyer meeting scheduled for next Tuesday.',                                   due_date: daysFromNow(5),  created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'risk',        description: 'Open orders aging past 30 days',                                        sales_channel: 'Wholesale',         owner: '11111111-1111-1111-1111-111111111005', owner_name: 'Noah Smith',     impact_low: -180000, impact_mid: -145000, impact_high: -100000, probability: 0.50, classification: 'base',        status: 'in_progress', next_steps: 'Ops working through credit holds.',                                            due_date: daysFromNow(7),  created_at: now(), updated_at: now() },
  ],

  initiatives: [
    { id: uid(), name: 'Mega Can Launch',           description: 'New 16oz can format for convenience and c-store channel', owner: '11111111-1111-1111-1111-111111111007', owner_name: 'JR Hernandez', sales_channel: null,     stage: 'evaluating',   revenue_potential: 800000,  ops_difficulty: 4, strategic_alignment: 5, time_to_execute: 'Q3 2026', required_investment: 180000, dependencies: 'Co-packer capacity, label FDA clearance', confidence_level: 'medium', confidential: false, created_at: now(), updated_at: now() },
    { id: uid(), name: 'Mid-Content Shot Line',     description: 'Lower-potency daily format for mass retail acceptance',   owner: '11111111-1111-1111-1111-111111111007', owner_name: 'JR Hernandez', sales_channel: null,     stage: 'idea',         revenue_potential: 450000,  ops_difficulty: 3, strategic_alignment: 4, time_to_execute: 'Q4 2026', required_investment: 120000, dependencies: 'R&D formulation',                         confidence_level: 'medium', confidential: false, created_at: now(), updated_at: now() },
    { id: uid(), name: 'Resealable Can',            description: 'Larger resealable format for on-premise',                 owner: '11111111-1111-1111-1111-111111111007', owner_name: 'JR Hernandez', sales_channel: null,     stage: 'idea',         revenue_potential: 300000,  ops_difficulty: 4, strategic_alignment: 3, time_to_execute: 'Q1 2027', required_investment: 80000,  dependencies: 'Tooling lead time',                       confidence_level: 'low',    confidential: false, created_at: now(), updated_at: now() },
    { id: uid(), name: 'White Label Program',       description: 'White-label strategy for strategic distributor partners',  owner: '11111111-1111-1111-1111-111111111001', owner_name: 'Todd Allison', sales_channel: null,     stage: 'evaluating',   revenue_potential: 1200000, ops_difficulty: 5, strategic_alignment: 5, time_to_execute: 'Q4 2026', required_investment: 250000, dependencies: 'Legal review, customer commitment',         confidence_level: 'medium', confidential: true,  created_at: now(), updated_at: now() },
    { id: uid(), name: '4th of July Activation',    description: 'National promo with tentpole merchandising',               owner: '11111111-1111-1111-1111-111111111001', owner_name: 'Todd Allison', sales_channel: null,     stage: 'approved',     revenue_potential: 625000,  ops_difficulty: 2, strategic_alignment: 4, time_to_execute: 'July',    required_investment: 35000,  dependencies: 'POS materials procurement',                 confidence_level: 'high',   confidential: false, created_at: now(), updated_at: now() },
    { id: uid(), name: 'Distributor Scorecard 2.0', description: 'Structured partner-level scorecards and QBRs',             owner: '11111111-1111-1111-1111-111111111008', owner_name: 'Nick Kemper',  sales_channel: null,     stage: 'in_execution', revenue_potential: 250000,  ops_difficulty: 2, strategic_alignment: 4, time_to_execute: 'Q2 2026', required_investment: 5000,   dependencies: null,                                        confidence_level: 'high',   confidential: false, created_at: now(), updated_at: now() },
    { id: uid(), name: 'Sprouts Expansion',         description: 'Add 3 SKUs at Sprouts nationally',                         owner: '11111111-1111-1111-1111-111111111006', owner_name: 'Joe Sanders',  sales_channel: 'Chains', stage: 'approved',     revenue_potential: 180000,  ops_difficulty: 3, strategic_alignment: 3, time_to_execute: 'Q2 2026', required_investment: 20000,  dependencies: 'Shelf reset timing',                        confidence_level: 'medium', confidential: false, created_at: now(), updated_at: now() },
  ],

  scoring_weights: [
    { id: uid(), criterion: 'revenue_potential',   weight: 3.0, updated_at: now() },
    { id: uid(), criterion: 'ops_difficulty',      weight: 2.5, updated_at: now() },
    { id: uid(), criterion: 'strategic_alignment', weight: 2.0, updated_at: now() },
    { id: uid(), criterion: 'time_to_execute',     weight: 1.5, updated_at: now() },
    { id: uid(), criterion: 'required_investment', weight: 1.0, updated_at: now() },
  ],

  promos: [
    { id: uid(), name: '4th of July Program',    start_date: '2026-07-01', end_date: '2026-07-07', channels: ['Conventional', 'New Distribution', 'Wholesale', 'Chains'], regions: ['Florida', 'West', 'North'], target_revenue: 650000, pricing_mechanics: '2 for $10 suggested SRP',               materials_needed: { case_stackers: 100, acrylics: 200, shelf_talkers: 500 }, distributor_requirements: '60-day pricing notice to distributors; feature ads in week 27', status: 'planning', owner: '11111111-1111-1111-1111-111111111001', owner_name: 'Todd Allison', created_at: now(), updated_at: now() },
    { id: uid(), name: 'Memorial Day Kickoff',   start_date: '2026-05-22', end_date: '2026-05-29', channels: ['Chains', 'Conventional'],                                    regions: ['Florida', 'West'],         target_revenue: 220000, pricing_mechanics: 'BOGO 50% off at Sprouts, $4.99 SRP elsewhere', materials_needed: { case_stackers: 40, acrylics: 80 },                        distributor_requirements: '30-day notice to chain partners',                                status: 'planning', owner: '11111111-1111-1111-1111-111111111006', owner_name: 'Joe Sanders',  created_at: now(), updated_at: now() },
    { id: uid(), name: 'Spring Seltzer Launch',  start_date: '2026-04-15', end_date: '2026-04-30', channels: ['Chains', 'Wholesale'],                                       regions: ['Florida', 'West', 'North'], target_revenue: 150000, pricing_mechanics: 'Intro pricing $3.99 SRP',               materials_needed: { shelf_talkers: 300, end_cap_kits: 20 },                   distributor_requirements: 'New item setup complete with top 5 chains',                      status: 'active',   owner: '11111111-1111-1111-1111-111111111007', owner_name: 'JR Hernandez', created_at: now(), updated_at: now() },
  ],

  distributor_targets: [
    { id: uid(), fiscal_year: 2026, month: 4, distributor_name: 'SouthCo Beverage Group',      target_revenue: 145000, sales_region: 'South' },
    { id: uid(), fiscal_year: 2026, month: 4, distributor_name: 'Rocky Mountain Distributing', target_revenue: 95000,  sales_region: 'West' },
    { id: uid(), fiscal_year: 2026, month: 4, distributor_name: 'Atlantic Trade Partners',     target_revenue: 60000,  sales_region: 'East' },
    { id: uid(), fiscal_year: 2026, month: 4, distributor_name: 'Humboldt Beverage',           target_revenue: 55000,  sales_region: 'West' },
    { id: uid(), fiscal_year: 2026, month: 4, distributor_name: 'Zuma Distribution',           target_revenue: 125000, sales_region: 'Florida' },
    { id: uid(), fiscal_year: 2026, month: 4, distributor_name: 'Sacani Distributors',         target_revenue: 40000,  sales_region: 'West' },
    { id: uid(), fiscal_year: 2026, month: 4, distributor_name: 'Beauchamp Beverage',          target_revenue: 35000,  sales_region: 'West' },
    { id: uid(), fiscal_year: 2026, month: 4, distributor_name: 'Guardian Beverage',           target_revenue: 45000,  sales_region: 'West' },
  ],

  miss_impact_assumptions: [
    { id: uid(), assumption_key: 'sku_substitution_rate',       assumption_value: 0.35,  description: 'Portion of delayed volume that draws down other SKU inventory' },
    { id: uid(), assumption_key: 'substitution_recovery_rate',  assumption_value: 0.50,  description: 'Portion of substituted volume that is later backfilled' },
    { id: uid(), assumption_key: 'momentum_drag_m1',            assumption_value: 0.10,  description: 'Month 1 trailing shelf-presence drag' },
    { id: uid(), assumption_key: 'momentum_drag_m2',            assumption_value: 0.15,  description: 'Month 2 trailing shelf-presence drag' },
    { id: uid(), assumption_key: 'momentum_drag_m3',            assumption_value: 0.08,  description: 'Month 3 trailing shelf-presence drag' },
    { id: uid(), assumption_key: 'cancellation_rate',           assumption_value: 0.12,  description: 'Portion of delayed orders outright cancelled' },
    { id: uid(), assumption_key: 'cost_of_capital_annual',      assumption_value: 0.10,  description: 'Annualized cost of capital' },
    { id: uid(), assumption_key: 'affected_stores_pct',         assumption_value: 0.25,  description: 'Share of retail doors affected by a single miss event' },
    { id: uid(), assumption_key: 'revenue_per_affected_store',  assumption_value: 2500,  description: 'Average monthly revenue per affected store' },
    { id: uid(), assumption_key: 'total_retail_doors',          assumption_value: 800,   description: 'Total retail doors in ACV' },
  ],

  activity_log: [
    { id: uid(), user_id: '11111111-1111-1111-1111-111111111005', user_name: 'Noah Smith',      action: 'submitted', entity_type: 'forecast',  entity_id: null, details: { customer: 'KeHE Distributors', amount: 180000 },      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
    { id: uid(), user_id: '11111111-1111-1111-1111-111111111001', user_name: 'Todd Allison',    action: 'approved',  entity_type: 'forecast',  entity_id: null, details: { customer: 'KeHE Distributors' },                      created_at: new Date(Date.now() - 1000 * 60 * 4).toISOString() },
    { id: uid(), user_id: '11111111-1111-1111-1111-111111111008', user_name: 'Nick Kemper',     action: 'updated',   entity_type: 'ro_item',   entity_id: null, details: { description: 'Distributor partners below 80%' },        created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
    { id: uid(), user_id: '11111111-1111-1111-1111-111111111003', user_name: 'Evan Beard',      action: 'submitted', entity_type: 'forecast',  entity_id: null, details: { customer: 'SouthCo Beverage Group', amount: 145000 }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    { id: uid(), user_id: '11111111-1111-1111-1111-111111111007', user_name: 'JR Hernandez',    action: 'created',   entity_type: 'initiative', entity_id: null, details: { name: 'Mid-Content Shot Line' },                      created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
  ],

  comments: [],
}

// -----------------------------------------------------------------------------
// Reactive store with subscription support
// -----------------------------------------------------------------------------

const listeners = new Set()
const state = seed

export const mockStore = {
  // reactive
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  _emit(table) {
    listeners.forEach((fn) => fn(table))
  },

  // SELECT
  list(table) {
    return [...(state[table] || [])]
  },
  find(table, id) {
    return (state[table] || []).find((r) => r.id === id)
  },

  // INSERT
  insert(table, row) {
    const full = { id: row.id || uid(), created_at: now(), updated_at: now(), ...row }
    state[table] = [...(state[table] || []), full]
    this._emit(table)
    return full
  },

  // UPDATE
  update(table, id, patch) {
    state[table] = (state[table] || []).map((r) =>
      r.id === id ? { ...r, ...patch, updated_at: now() } : r
    )
    this._emit(table)
    return this.find(table, id)
  },

  // DELETE
  remove(table, id) {
    state[table] = (state[table] || []).filter((r) => r.id !== id)
    this._emit(table)
  },

  // Bulk helpers
  setAll(table, rows) {
    state[table] = rows
    this._emit(table)
  },

  // Convenience: activity log writer
  log(action, entity_type, entity_id, details, user) {
    this.insert('activity_log', {
      user_id: user?.id,
      user_name: user?.full_name,
      action,
      entity_type,
      entity_id,
      details,
    })
  },
}
