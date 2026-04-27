/**
 * BigQuery read-layer API stub.
 *
 * This Express server mimics the endpoints that the real BigQuery
 * middleware will expose once wired up. It serves realistic sample
 * "actuals" data so the frontend is fully demonstrable without a
 * live BigQuery connection.
 *
 * To swap in the real BigQuery client:
 *   1. npm install @google-cloud/bigquery
 *   2. Replace each handler below with a SQL query against
 *      `elevate-analytics-361821.elevate_rollup_tables.revenue_rollup`
 *      using the same business-logic rule documented in the spec
 *      (business_channel = 'Distributor' AND order_type = 'New Deal'
 *       → sales_rep_clean='Evan Beard', business_channel_v2='New Distribution').
 *
 * Run:
 *   node api/server.js
 *
 * Endpoints:
 *   GET /api/actuals/revenue           ?fiscal_year&month
 *   GET /api/actuals/by-channel        ?fiscal_year&month
 *   GET /api/actuals/by-distributor    ?fiscal_year&month
 *   GET /api/actuals/by-product        ?fiscal_year&month
 *   GET /api/actuals/daily-pacing      ?fiscal_year&month
 *   GET /api/actuals/trend             ?fiscal_year&months=6
 */

import http from 'node:http'
import { URL } from 'node:url'

const PORT = process.env.API_PORT || 3001

// ---------------------------------------------------------------------------
// Sample data (what BigQuery would return, post business-logic remap).
// Numbers are chosen to pair with the seed annual_plan rows so the variance
// calculations in the dashboard land in a realistic place for the demo.
// ---------------------------------------------------------------------------

const CHANNELS = ['Conventional', 'New Distribution', 'Wholesale', 'Chains', 'Inbound', 'B2C']

// Month-level actuals for FY2026, keyed by `${year}-${month}-${channel}`.
// Pattern: Q1 tracking near plan, Q2 lagging (April in particular pacing below).
const ACTUALS_BY_CHANNEL_MONTHLY = {
  // January — on plan
  '2026-1-Conventional':     { revenue: 815000, units: 67500 },
  '2026-1-New Distribution': { revenue: 295000, units: 24600 },
  '2026-1-Wholesale':        { revenue: 305000, units: 25400 },
  '2026-1-Chains':           { revenue: 202000, units: 16200 },
  '2026-1-Inbound':          { revenue: 198000, units: 15800 },
  '2026-1-B2C':              { revenue: 182000, units: 14100 },
  // February
  '2026-2-Conventional':     { revenue: 805000, units: 67000 },
  '2026-2-New Distribution': { revenue: 325000, units: 26800 },
  '2026-2-Wholesale':        { revenue: 300000, units: 25000 },
  '2026-2-Chains':           { revenue: 215000, units: 17400 },
  '2026-2-Inbound':          { revenue: 205000, units: 16500 },
  '2026-2-B2C':              { revenue: 188000, units: 14800 },
  // March
  '2026-3-Conventional':     { revenue: 840000, units: 69500 },
  '2026-3-New Distribution': { revenue: 340000, units: 28300 },
  '2026-3-Wholesale':        { revenue: 315000, units: 26300 },
  '2026-3-Chains':           { revenue: 225000, units: 18400 },
  '2026-3-Inbound':          { revenue: 218000, units: 17800 },
  '2026-3-B2C':              { revenue: 205000, units: 16400 },
  // April — MTD through April 23 (pacing light)
  '2026-4-Conventional':     { revenue: 605000, units: 50200 },
  '2026-4-New Distribution': { revenue: 215000, units: 17900 },
  '2026-4-Wholesale':        { revenue: 240000, units: 20000 },
  '2026-4-Chains':           { revenue: 170000, units: 13800 },
  '2026-4-Inbound':          { revenue: 155000, units: 12500 },
  '2026-4-B2C':              { revenue: 140000, units: 11000 },
}

const DISTRIBUTOR_ACTUALS_APR = [
  { distributor: 'JJT Alternatives, LLC.',                              revenue: 176000, units: 14600, fill_rate: 0.96, order_frequency: 4 },
  { distributor: 'Briggs Distributing',                                  revenue: 71800,  units: 5950,  fill_rate: 0.93, order_frequency: 3 },
  { distributor: '4 Stories LLC',                                        revenue: 77200,  units: 6400,  fill_rate: 0.92, order_frequency: 3 },
  { distributor: 'Carroll Distributing Company (FL)',                    revenue: 75300,  units: 6240,  fill_rate: 0.94, order_frequency: 3 },
  { distributor: 'Fabiano Brothers- Bay City',                           revenue: 52300,  units: 4350,  fill_rate: 0.89, order_frequency: 3 },
  { distributor: 'Champion Brands',                                      revenue: 38300,  units: 3180,  fill_rate: 0.88, order_frequency: 2 },
  { distributor: 'Southern Horizon Logistics LLC - Charleston Branch',   revenue: 41600,  units: 3450,  fill_rate: 0.91, order_frequency: 2 },
  { distributor: 'Guardian Distributors',                                revenue: 25400,  units: 2100,  fill_rate: 0.74, order_frequency: 2 },
  { distributor: 'Zuma and Sons Distributor Corp',                       revenue: 29800,  units: 2470,  fill_rate: 0.86, order_frequency: 2 },
  { distributor: 'SF Naturals',                                          revenue: 22700,  units: 1880,  fill_rate: 0.78, order_frequency: 1 },
  { distributor: 'Jerome Distributing- Bismarck',                        revenue: 20900,  units: 1730,  fill_rate: 0.81, order_frequency: 1 },
  { distributor: 'Saccani Distributing',                                 revenue: 23800,  units: 1970,  fill_rate: 0.72, order_frequency: 1 },
]

const PRODUCT_ACTUALS_APR = [
  { category: 'Shots',    revenue: 985000, units: 82000 },
  { category: 'Seltzers', revenue: 315000, units: 26300 },
  { category: 'Sticks',   revenue: 145000, units: 58000 },
  { category: 'Kegs',     revenue: 80000,  units: 260 },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=600', // 10-min cache — BigQuery refreshes daily
  })
  res.end(JSON.stringify(body))
}

function parseParams(urlObj) {
  const fiscal_year = parseInt(urlObj.searchParams.get('fiscal_year') || '2026', 10)
  const month = parseInt(urlObj.searchParams.get('month') || '4', 10)
  const months = parseInt(urlObj.searchParams.get('months') || '6', 10)
  return { fiscal_year, month, months }
}

function channelBreakdown(year, month) {
  return CHANNELS.map((ch) => ({
    sales_channel: ch,
    ...(ACTUALS_BY_CHANNEL_MONTHLY[`${year}-${month}-${ch}`] || { revenue: 0, units: 0 }),
  }))
}

function totalRevenue(year, month) {
  return channelBreakdown(year, month).reduce((sum, r) => sum + r.revenue, 0)
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const ROUTES = {
  '/api/actuals/revenue': (urlObj) => {
    const { fiscal_year, month } = parseParams(urlObj)
    const rows = channelBreakdown(fiscal_year, month)
    return {
      fiscal_year,
      month,
      total_revenue: rows.reduce((s, r) => s + r.revenue, 0),
      total_units: rows.reduce((s, r) => s + r.units, 0),
      as_of: new Date().toISOString(),
    }
  },

  '/api/actuals/by-channel': (urlObj) => {
    const { fiscal_year, month } = parseParams(urlObj)
    return {
      fiscal_year,
      month,
      rows: channelBreakdown(fiscal_year, month),
      as_of: new Date().toISOString(),
    }
  },

  '/api/actuals/by-distributor': (urlObj) => {
    const { fiscal_year, month } = parseParams(urlObj)
    // In this stub we only vary April; a real impl would filter by month.
    return {
      fiscal_year,
      month,
      rows: DISTRIBUTOR_ACTUALS_APR,
      as_of: new Date().toISOString(),
    }
  },

  '/api/actuals/by-product': (urlObj) => {
    const { fiscal_year, month } = parseParams(urlObj)
    return {
      fiscal_year,
      month,
      rows: PRODUCT_ACTUALS_APR,
      as_of: new Date().toISOString(),
    }
  },

  '/api/actuals/daily-pacing': (urlObj) => {
    const { fiscal_year, month } = parseParams(urlObj)
    // Simulate day-by-day MTD pacing through day 23 (current day in demo).
    const monthTotal = totalRevenue(fiscal_year, month)
    const currentDay = 23
    const daysInMonth = 30
    // Mildly lumpy distribution with a dip mid-month.
    const factors = [1.0, 1.1, 0.9, 0.8, 1.2, 1.1, 0.5, 0.4, 1.3, 1.4, 1.1,
                     0.9, 0.7, 0.6, 0.9, 1.2, 1.3, 1.1, 0.9, 0.5, 0.4, 1.0, 1.1]
    const factorSum = factors.reduce((a, b) => a + b, 0)
    const rows = factors.map((f, i) => ({
      day: i + 1,
      revenue: Math.round((monthTotal * f) / factorSum),
    }))
    const mtdRevenue = rows.reduce((s, r) => s + r.revenue, 0)
    return {
      fiscal_year,
      month,
      current_day: currentDay,
      days_in_month: daysInMonth,
      mtd_revenue: mtdRevenue,
      rows,
      as_of: new Date().toISOString(),
    }
  },

  '/api/actuals/trend': (urlObj) => {
    const { fiscal_year, month, months } = parseParams(urlObj)
    const rows = []
    for (let i = months - 1; i >= 0; i--) {
      let m = month - i
      let y = fiscal_year
      while (m < 1) {
        m += 12
        y -= 1
      }
      rows.push({
        fiscal_year: y,
        month: m,
        total_revenue: CHANNELS.reduce(
          (sum, ch) => sum + (ACTUALS_BY_CHANNEL_MONTHLY[`${y}-${m}-${ch}`]?.revenue || 0),
          0
        ),
      })
    }
    return { rows, as_of: new Date().toISOString() }
  },
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end()
    return
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' })

  const urlObj = new URL(req.url, `http://localhost:${PORT}`)
  const handler = ROUTES[urlObj.pathname]
  if (!handler) return send(res, 404, { error: 'Not found', path: urlObj.pathname })
  try {
    send(res, 200, handler(urlObj))
  } catch (err) {
    send(res, 500, { error: String(err?.message || err) })
  }
})

server.listen(PORT, () => {
  console.log(`BigQuery stub API listening on http://localhost:${PORT}`)
  console.log('Available endpoints:')
  Object.keys(ROUTES).forEach((r) => console.log(`  GET ${r}`))
})
