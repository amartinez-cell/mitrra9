/**
 * Helpers specific to the Forecast Grid.
 *
 * - Formatting cells as $X,XXX.X K
 * - Parsing user input (handles "$", commas, "K" suffix)
 * - Determining which months are past / current / future
 */

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export const FY = 2026

/**
 * The "current month" the app considers itself in for demo purposes.
 * In a real deploy this would be derived from new Date().
 */
export const DEMO_CURRENT_MONTH = 4 // April

/**
 * Classify a month relative to the current period:
 *   'past'    — fully closed; show actual; not editable
 *   'current' — month-in-progress; show actual MTD; not editable (live from BigQuery)
 *   'future'  — editable forecast cell
 */
export function periodState(month, currentMonth = DEMO_CURRENT_MONTH) {
  if (month < currentMonth) return 'past'
  if (month === currentMonth) return 'current'
  return 'future'
}

/**
 * Compact grid format. Always shows in K to keep the grid tight.
 *   12500 → "12.5"
 *   1250000 → "1,250.0"
 *   0 → ""
 *   null → ""
 */
export function fmtCell(value) {
  if (value == null || value === '' || isNaN(value)) return ''
  const k = Number(value) / 1000
  if (k === 0) return ''
  // Use comma separator + 1 decimal
  return k.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function fmtCellSigned(value) {
  if (value == null || value === '' || isNaN(value)) return ''
  const k = Number(value) / 1000
  if (k === 0) return ''
  const sign = k > 0 ? '+' : ''
  return sign + k.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/**
 * Parse user input. Accepts:
 *   "12500"        → 12500
 *   "12,500"       → 12500
 *   "$12,500"      → 12500
 *   "12.5K" / "12.5k" → 12500
 *   "1.2M" / "1.2m"   → 1200000
 *   ""             → 0 (clears the cell)
 *   "abc"          → null (signal: invalid input, don't update)
 */
export function parseCell(input) {
  if (input == null) return 0
  const s = String(input).trim()
  if (s === '') return 0
  const cleaned = s.replace(/[$,\s]/g, '')
  const m = cleaned.match(/^(-?\d+\.?\d*)\s*([kKmM]?)$/)
  if (!m) return null
  const n = parseFloat(m[1])
  if (isNaN(n)) return null
  const suffix = m[2].toLowerCase()
  if (suffix === 'k') return Math.round(n * 1000 * 100) / 100
  if (suffix === 'm') return Math.round(n * 1000000 * 100) / 100
  return Math.round(n * 100) / 100
}

/**
 * Year/month → ISO date for column headers
 */
export function monthHeaderLabel(year, month) {
  return `${MONTH_NAMES[month - 1]} ${String(year).slice(2)}`
}

/**
 * Format a $ value compact, used for subtotal cells (slightly bigger format).
 *   1543200 → "$1,543.2K"
 *   543200  → "$543.2K"
 *   0       → "—"
 */
export function fmtCompactDollar(value) {
  if (value == null || value === 0 || isNaN(value)) return '—'
  const k = Number(value) / 1000
  return '$' + k.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'K'
}

/**
 * Channel ordering used everywhere in the grid
 */
export const CHANNEL_ORDER = ['Conventional', 'Inbound', 'New Distribution', 'Wholesale', 'Chains']

/**
 * Region ordering for Conventional
 */
export const REGION_ORDER = ['Florida', 'North', 'West', 'East', 'South']
