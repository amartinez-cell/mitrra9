/**
 * Formatting utilities. Dollar amounts follow Albert's convention:
 * comma formatting at or above $1,000K (e.g. "$1,016.3K").
 */

export function fmtCurrency(value, { compact = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—'
  const abs = Math.abs(value)
  if (compact) {
    if (abs >= 1_000_000) {
      const k = value / 1000
      // Force comma grouping at the K level per spec
      const formatted = k.toLocaleString('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
      return `$${formatted}K`
    }
    if (abs >= 1_000) {
      const k = value / 1000
      return `$${k.toFixed(1)}K`
    }
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function fmtCompactCurrency(value) {
  return fmtCurrency(value, { compact: true })
}

export function fmtPct(value, { decimals = 1 } = {}) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(decimals)}%`
}

export function fmtNumber(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US')
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function fmtRelative(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

// RAG classification by % to plan
export function ragColor(pctToPlan) {
  if (pctToPlan == null) return 'slate'
  if (pctToPlan >= 0.95) return 'green'
  if (pctToPlan >= 0.80) return 'amber'
  return 'red'
}

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function monthName(m) {
  return MONTHS[m - 1] || ''
}

export function classNames(...parts) {
  return parts.filter(Boolean).join(' ')
}
