/**
 * Local mock of the BigQuery read-layer responses. Used when the stub
 * API is not running. Numbers are aligned with the sample annual_plan
 * rows in supabase/seed/001_seed.sql.
 */

const CHANNELS = ['Conventional', 'New Distribution', 'Wholesale', 'Chains', 'Inbound', 'B2C']

const BY_CHANNEL = {
  '2026-1':  { Conventional: 815000, 'New Distribution': 295000, Wholesale: 305000, Chains: 202000, Inbound: 198000, B2C: 182000 },
  '2026-2':  { Conventional: 805000, 'New Distribution': 325000, Wholesale: 300000, Chains: 215000, Inbound: 205000, B2C: 188000 },
  '2026-3':  { Conventional: 840000, 'New Distribution': 340000, Wholesale: 315000, Chains: 225000, Inbound: 218000, B2C: 205000 },
  '2026-4':  { Conventional: 605000, 'New Distribution': 215000, Wholesale: 240000, Chains: 170000, Inbound: 155000, B2C: 140000 },
}

const UNITS_BY_CHANNEL = {
  '2026-4': { Conventional: 50200, 'New Distribution': 17900, Wholesale: 20000, Chains: 13800, Inbound: 12500, B2C: 11000 },
}

const DISTRIBUTORS_APR = [
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

const PRODUCT_APR = [
  { category: 'Shots',    revenue: 985000, units: 82000 },
  { category: 'Seltzers', revenue: 315000, units: 26300 },
  { category: 'Sticks',   revenue: 145000, units: 58000 },
  { category: 'Kegs',     revenue: 80000,  units: 260 },
]

function key(y, m) { return `${y}-${m}` }

function channelRows(y, m) {
  const k = key(y, m)
  const rev = BY_CHANNEL[k] || {}
  const units = UNITS_BY_CHANNEL[k] || {}
  return CHANNELS.map((ch) => ({
    sales_channel: ch,
    revenue: rev[ch] || 0,
    units: units[ch] || 0,
  }))
}

export const MOCK_ACTUALS = {
  revenueSummary(y, m) {
    const rows = channelRows(y, m)
    return {
      fiscal_year: y,
      month: m,
      total_revenue: rows.reduce((s, r) => s + r.revenue, 0),
      total_units: rows.reduce((s, r) => s + r.units, 0),
      as_of: new Date().toISOString(),
    }
  },
  byChannel(y, m) {
    return { fiscal_year: y, month: m, rows: channelRows(y, m), as_of: new Date().toISOString() }
  },
  byDistributor(y, m) {
    return { fiscal_year: y, month: m, rows: DISTRIBUTORS_APR, as_of: new Date().toISOString() }
  },
  byProduct(y, m) {
    return { fiscal_year: y, month: m, rows: PRODUCT_APR, as_of: new Date().toISOString() }
  },
  dailyPacing(y, m) {
    const total = channelRows(y, m).reduce((s, r) => s + r.revenue, 0)
    const factors = [1.0, 1.1, 0.9, 0.8, 1.2, 1.1, 0.5, 0.4, 1.3, 1.4, 1.1,
                     0.9, 0.7, 0.6, 0.9, 1.2, 1.3, 1.1, 0.9, 0.5, 0.4, 1.0, 1.1]
    const fsum = factors.reduce((a, b) => a + b, 0)
    const rows = factors.map((f, i) => ({ day: i + 1, revenue: Math.round((total * f) / fsum) }))
    return {
      fiscal_year: y,
      month: m,
      current_day: 23,
      days_in_month: 30,
      mtd_revenue: rows.reduce((s, r) => s + r.revenue, 0),
      rows,
      as_of: new Date().toISOString(),
    }
  },
  trend(y, m, months = 6) {
    const rows = []
    for (let i = months - 1; i >= 0; i--) {
      let mm = m - i
      let yy = y
      while (mm < 1) { mm += 12; yy -= 1 }
      const k = key(yy, mm)
      const rev = BY_CHANNEL[k]
      rows.push({
        fiscal_year: yy,
        month: mm,
        total_revenue: rev ? Object.values(rev).reduce((a, b) => a + b, 0) : 0,
      })
    }
    return { rows, as_of: new Date().toISOString() }
  },
}
