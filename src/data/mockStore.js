/**
 * Mock data store. Holds all user-generated data (forecasts, R&O items,
 * initiatives, promos, bridge buckets, etc.) in memory with simple
 * CRUD + subscription helpers. Mirrors the subset of the Supabase API
 * the UI actually uses so swapping to real Supabase is mechanical.
 *
 * Demo data matches the seed in supabase/seed/002_seed_grid.sql.
 */

import {
  SEED_PROFILES, SEED_REGIONS, SEED_TEAMS,
  SEED_DISTRIBUTORS, SEED_DISTRIBUTOR_TARGETS, SEED_YEARLY_TARGETS, SEED_FORECAST_CELLS,
  SEED_REP_TARGETS,
  SEED_DIRECTORS, DIRECTOR_CHANNEL_OWNERSHIP,
} from './seedMaster'
import {
  SEED_SKUS, SEED_PRICING_TIERS, SEED_POS_MATERIALS,
} from './seedPromo'

// --- helpers ---
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

// Quick name → id lookup for hardcoded seed references below
const idOf = {}
SEED_PROFILES.forEach((p) => { idOf[p.full_name] = p.id })
SEED_DIRECTORS.forEach((p) => { idOf[p.full_name] = p.id })

// Merge profiles + directors. Promote Evan and JR to 'director' role since
// they own multiple channels at the leadership level.
const ALL_PROFILES = (() => {
  const merged = [...SEED_PROFILES]
  // Promote existing reps/managers to directors where applicable
  for (const p of merged) {
    if (p.full_name === 'Evan Beard' || p.full_name === 'JR Hernandez') {
      p.role = 'director'
    }
  }
  // Append new directors
  for (const d of SEED_DIRECTORS) {
    if (!merged.find((p) => p.email === d.email)) merged.push(d)
  }
  return merged
})()

// Roll annual plan up to channel × month from the master distributor data
function rollupAnnualPlanFromDistributors() {
  const out = []
  for (let m = 1; m <= 12; m++) {
    const byCh = {}
    for (const d of SEED_DISTRIBUTORS) {
      const v = d._monthly[m - 1] || 0
      byCh[d.channel] = (byCh[d.channel] || 0) + v
    }
    for (const [channel, planned_revenue] of Object.entries(byCh)) {
      out.push({
        id: `plan-${m}-${channel}`,
        fiscal_year: 2026,
        month: m,
        sales_channel: channel,
        planned_revenue,
        planned_units: Math.round(planned_revenue / 12),
        updated_at: now(),
      })
    }
  }
  return out
}

// -----------------------------------------------------------------------------
// Initial seed
// -----------------------------------------------------------------------------

const seed = {
  // --- Master data (from seedMaster) ---
  profiles: ALL_PROFILES.map((p) => ({ ...p, created_at: now() })),
  regions: SEED_REGIONS,
  teams: SEED_TEAMS,
  distributors: SEED_DISTRIBUTORS.map((d) => {
    const { _yearly, _monthly, ...rest } = d
    return { ...rest, created_at: now(), updated_at: now() }
  }),
  distributor_yearly_targets: SEED_YEARLY_TARGETS,
  distributor_targets: SEED_DISTRIBUTOR_TARGETS,
  forecast_cells: SEED_FORECAST_CELLS,
  forecast_submissions: [],
  rep_targets: SEED_REP_TARGETS,

  // --- Promo / pricing / SKU master ---
  skus: SEED_SKUS,
  pricing_tiers: SEED_PRICING_TIERS,
  pos_materials: SEED_POS_MATERIALS,
  promos_v2: [],                    // start fresh per business request
  promo_sku_lines: [],
  promo_trade_spend_lines: [],

  // Annual plan rolled up by channel × month, derived from the dp_targets
  // monthly cells. Used by the dashboard and other channel-level views.
  annual_plan: rollupAnnualPlanFromDistributors(),

  // forecast_entries kept around so the older Plan & Forecast page can render
  // gracefully until the grid replaces it
  forecast_entries: [],

  bridge_buckets: [
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'West Red Tag',                     dollar_impact: -252000,  units_impact: -21000,  commentary: 'Humboldt, Saccani, Beauchamp, Guardian under plan. RO open with Lexi.', sort_order: 1, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'Distributor Partners — Under',     dollar_impact: -1300000, units_impact: -108000, commentary: 'Partners below 80% target. Recovery plan in progress.',                  sort_order: 2, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'Go Gets Not Materialized',         dollar_impact: -668000,  units_impact: -55000,  commentary: 'Pipeline slipped from Q1, re-baselined.',                                 sort_order: 3, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'Open Orders',                       dollar_impact: -145000,  units_impact: -12000,  commentary: 'Orders placed but not yet shipped end-of-period.',                        sort_order: 4, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: '4th of July Program (partial)',    dollar_impact: 150000,   units_impact: 12500,   commentary: 'Pre-sell beginning in June.',                                             sort_order: 5, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'New Distribution Pipeline',        dollar_impact: 109000,   units_impact: 9000,    commentary: 'Evan\'s three closed deals this quarter.',                                sort_order: 6, updated_at: now() },
    { id: uid(), fiscal_year: 2026, period_type: 'quarter', period_value: 2, bucket_name: 'Other',                              dollar_impact: -50000,   units_impact: -4000,   commentary: 'Minor miscellaneous variances.',                                          sort_order: 7, updated_at: now() },
  ],

  ro_items: [
    { id: uid(), item_type: 'risk',        description: 'West Red Tag underperformance — Humboldt, Saccani, Beauchamp, Guardian', sales_channel: 'Conventional',     owner: idOf['Lexi Palm'],    owner_name: 'Lexi Palm',     impact_low: -280000,  impact_mid: -252000,  impact_high: -200000, probability: 0.85, classification: 'base',        status: 'open',        next_steps: 'Lexi visiting top 4 accounts next week. Recovery plan due Monday.', due_date: daysFromNow(7),  created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'risk',        description: 'Distributor partners below 80% target',                                  sales_channel: 'New Distribution', owner: idOf['Evan Beard'],   owner_name: 'Evan Beard',    impact_low: -1400000, impact_mid: -1300000, impact_high: -1100000, probability: 0.75, classification: 'base',        status: 'in_progress', next_steps: 'Weekly check-ins initiated. 3 partner-level action plans under review.', due_date: daysFromNow(14), created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'risk',        description: 'Go Gets not materialized',                                              sales_channel: null,                owner: null,                  owner_name: 'Team',          impact_low: -750000,  impact_mid: -668000,  impact_high: -500000, probability: 0.60, classification: 'incremental', status: 'open',        next_steps: 'Re-baseline pipeline. JR/Todd reviewing deal-level probability.', due_date: daysFromNow(21), created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'opportunity', description: '4th of July promotional program',                                       sales_channel: null,                owner: idOf['Todd Allison'], owner_name: 'Todd Allison',  impact_low: 550000,   impact_mid: 625000,   impact_high: 700000,  probability: 0.80, classification: 'incremental', status: 'in_progress', next_steps: 'Creative brief in progress, distributor pricing notices due May 1.', due_date: daysFromNow(45), created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'opportunity', description: 'New Distribution pipeline — Evan deals',                                sales_channel: 'New Distribution', owner: idOf['Evan Beard'],   owner_name: 'Evan Beard',    impact_low: 90000,    impact_mid: 109000,   impact_high: 140000,  probability: 0.90, classification: 'base',        status: 'in_progress', next_steps: 'Three deals in contract review.', due_date: daysFromNow(10), created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'opportunity', description: 'Mega Can / new format launch',                                          sales_channel: null,                owner: idOf['JR Hernandez'], owner_name: 'JR Hernandez',  impact_low: 200000,   impact_mid: 400000,   impact_high: 800000,  probability: 0.35, classification: 'incremental', status: 'open',        next_steps: 'Sourcing co-packer. Go/no-go decision mid-Q3.', due_date: daysFromNow(60), created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'opportunity', description: 'Sprouts incremental shelf position',                                    sales_channel: 'Chains',            owner: idOf['Joe Sanders'],  owner_name: 'Joe Sanders',   impact_low: 40000,    impact_mid: 75000,    impact_high: 120000,  probability: 0.55, classification: 'incremental', status: 'open',        next_steps: 'Buyer meeting scheduled for next Tuesday.', due_date: daysFromNow(5),  created_at: now(), updated_at: now() },
    { id: uid(), item_type: 'risk',        description: 'Open orders aging past 30 days',                                        sales_channel: 'Wholesale',         owner: idOf['Noah Smith'],   owner_name: 'Noah Smith',    impact_low: -180000,  impact_mid: -145000,  impact_high: -100000, probability: 0.50, classification: 'base',        status: 'in_progress', next_steps: 'Ops working through credit holds.', due_date: daysFromNow(7),  created_at: now(), updated_at: now() },
  ],

  initiatives: [
    { id: uid(), name: 'Mega Can Launch',           description: 'New 16oz can format for convenience and c-store channel', owner: idOf['JR Hernandez'], owner_name: 'JR Hernandez', sales_channel: null,     stage: 'evaluating',   revenue_potential: 800000,  ops_difficulty: 4, strategic_alignment: 5, time_to_execute: 'Q3 2026', required_investment: 180000, dependencies: 'Co-packer capacity, label FDA clearance', confidence_level: 'medium', confidential: false, created_at: now(), updated_at: now() },
    { id: uid(), name: 'White Label Program',       description: 'White-label strategy for strategic distributor partners',  owner: idOf['Todd Allison'], owner_name: 'Todd Allison', sales_channel: null,     stage: 'evaluating',   revenue_potential: 1200000, ops_difficulty: 5, strategic_alignment: 5, time_to_execute: 'Q4 2026', required_investment: 250000, dependencies: 'Legal review, customer commitment',         confidence_level: 'medium', confidential: true,  created_at: now(), updated_at: now() },
    { id: uid(), name: '4th of July Activation',    description: 'National promo with tentpole merchandising',               owner: idOf['Todd Allison'], owner_name: 'Todd Allison', sales_channel: null,     stage: 'approved',     revenue_potential: 625000,  ops_difficulty: 2, strategic_alignment: 4, time_to_execute: 'July',    required_investment: 35000,  dependencies: 'POS materials procurement',                 confidence_level: 'high',   confidential: false, created_at: now(), updated_at: now() },
    { id: uid(), name: 'Distributor Scorecard 2.0', description: 'Structured partner-level scorecards and QBRs',             owner: idOf['Evan Beard'],   owner_name: 'Evan Beard',   sales_channel: null,     stage: 'in_execution', revenue_potential: 250000,  ops_difficulty: 2, strategic_alignment: 4, time_to_execute: 'Q2 2026', required_investment: 5000,   dependencies: null,                                        confidence_level: 'high',   confidential: false, created_at: now(), updated_at: now() },
    { id: uid(), name: 'Sprouts Expansion',         description: 'Add 3 SKUs at Sprouts nationally',                         owner: idOf['Joe Sanders'],  owner_name: 'Joe Sanders',  sales_channel: 'Chains', stage: 'approved',     revenue_potential: 180000,  ops_difficulty: 3, strategic_alignment: 3, time_to_execute: 'Q2 2026', required_investment: 20000,  dependencies: 'Shelf reset timing',                        confidence_level: 'medium', confidential: false, created_at: now(), updated_at: now() },
  ],

  scoring_weights: [
    { id: uid(), criterion: 'revenue_potential',   weight: 3.0, updated_at: now() },
    { id: uid(), criterion: 'ops_difficulty',      weight: 2.5, updated_at: now() },
    { id: uid(), criterion: 'strategic_alignment', weight: 2.0, updated_at: now() },
    { id: uid(), criterion: 'time_to_execute',     weight: 1.5, updated_at: now() },
    { id: uid(), criterion: 'required_investment', weight: 1.0, updated_at: now() },
  ],

  promos: [
    { id: uid(), name: '4th of July Program',   start_date: '2026-07-01', end_date: '2026-07-07', channels: ['Conventional', 'New Distribution', 'Wholesale', 'Chains'], regions: ['Florida', 'West', 'North'], target_revenue: 650000, pricing_mechanics: '2 for $10 suggested SRP',               materials_needed: { case_stackers: 100, acrylics: 200, shelf_talkers: 500 }, distributor_requirements: '60-day pricing notice; feature ads in week 27', status: 'planning', owner: idOf['Todd Allison'], owner_name: 'Todd Allison', created_at: now(), updated_at: now() },
    { id: uid(), name: 'Memorial Day Kickoff',  start_date: '2026-05-22', end_date: '2026-05-29', channels: ['Chains', 'Conventional'],                                    regions: ['Florida', 'West'],          target_revenue: 220000, pricing_mechanics: 'BOGO 50% off at Sprouts, $4.99 SRP elsewhere', materials_needed: { case_stackers: 40, acrylics: 80 },                       distributor_requirements: '30-day notice to chain partners',                status: 'planning', owner: idOf['Joe Sanders'],  owner_name: 'Joe Sanders',  created_at: now(), updated_at: now() },
    { id: uid(), name: 'Spring Seltzer Launch', start_date: '2026-04-15', end_date: '2026-04-30', channels: ['Chains', 'Wholesale'],                                       regions: ['Florida', 'West', 'North'], target_revenue: 150000, pricing_mechanics: 'Intro pricing $3.99 SRP',               materials_needed: { shelf_talkers: 300, end_cap_kits: 20 },                  distributor_requirements: 'New item setup complete with top 5 chains',      status: 'active',   owner: idOf['JR Hernandez'], owner_name: 'JR Hernandez', created_at: now(), updated_at: now() },
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
    { id: uid(), user_id: idOf['Steve Suarez'],    user_name: 'Steve Suarez',    action: 'updated',   entity_type: 'forecast_cells',  entity_id: null, details: { distributor: 'JJT Alternatives, LLC.', month: 5 },             created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
    { id: uid(), user_id: idOf['Todd Allison'],    user_name: 'Todd Allison',    action: 'approved',  entity_type: 'forecast_submissions', entity_id: null, details: { rep: 'Steve Suarez', month: 'May' },                          created_at: new Date(Date.now() - 1000 * 60 * 4).toISOString() },
    { id: uid(), user_id: idOf['Evan Beard'],      user_name: 'Evan Beard',      action: 'updated',   entity_type: 'ro_items',        entity_id: null, details: { description: 'Distributor partners below 80%' },               created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
    { id: uid(), user_id: idOf['Lexi Palm'],       user_name: 'Lexi Palm',       action: 'submitted', entity_type: 'forecast_submissions', entity_id: null, details: { rep: 'Lexi Palm', month: 'May' },                              created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    { id: uid(), user_id: idOf['JR Hernandez'],    user_name: 'JR Hernandez',    action: 'created',   entity_type: 'initiatives',     entity_id: null, details: { name: 'Mega Can Launch' },                                       created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
  ],

  comments: [],
}

// -----------------------------------------------------------------------------
// Reactive store with subscription support
// -----------------------------------------------------------------------------

const listeners = new Set()
const state = seed

export { DIRECTOR_CHANNEL_OWNERSHIP } from './seedMaster'

export const mockStore = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  _emit(table) { listeners.forEach((fn) => fn(table)) },

  list(table) { return [...(state[table] || [])] },
  find(table, id) { return (state[table] || []).find((r) => r.id === id) },

  insert(table, row) {
    const full = { id: row.id || uid(), created_at: now(), updated_at: now(), ...row }
    state[table] = [...(state[table] || []), full]
    this._emit(table)
    return full
  },

  update(table, id, patch) {
    state[table] = (state[table] || []).map((r) =>
      r.id === id ? { ...r, ...patch, updated_at: now() } : r
    )
    this._emit(table)
    return this.find(table, id)
  },

  remove(table, id) {
    state[table] = (state[table] || []).filter((r) => r.id !== id)
    this._emit(table)
  },

  setAll(table, rows) {
    state[table] = rows
    this._emit(table)
  },

  /**
   * Upsert a forecast_cell by (distributor_id, fiscal_year, month). The grid
   * uses this to write per-cell edits without needing to find the row first.
   */
  upsertForecastCell({ distributor_id, fiscal_year, month, forecasted_revenue, notes }, user) {
    const existing = (state.forecast_cells || []).find(
      (c) => c.distributor_id === distributor_id && c.fiscal_year === fiscal_year && c.month === month
    )
    if (existing) {
      this.update('forecast_cells', existing.id, {
        forecasted_revenue,
        ...(notes !== undefined ? { notes } : {}),
        updated_by: user?.id,
      })
    } else {
      this.insert('forecast_cells', {
        distributor_id, fiscal_year, month, forecasted_revenue,
        notes: notes ?? null,
        created_by: user?.id, updated_by: user?.id,
      })
    }
  },

  log(action, entity_type, entity_id, details, user) {
    this.insert('activity_log', {
      user_id: user?.id, user_name: user?.full_name,
      action, entity_type, entity_id, details,
    })
  },
}
