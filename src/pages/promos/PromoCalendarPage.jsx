/**
 * PromoCalendarPage — Gantt-style monthly view of promos.
 *
 * Each promo renders as a horizontal bar spanning its date range, grouped by
 * channel. Clicking a bar opens the readonly detail modal. Filters: channel,
 * region, owner, status. "+ Add Promo" button (manager/director only) opens
 * the full PromoForm in a modal.
 */

import { useMemo, useState } from 'react'
import { Plus, Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTable } from '../../hooks/useTable'
import { Modal } from '../../components/ui/Primitives'
import { fmtCompactCurrency, classNames } from '../../lib/format'
import { computePromoTotals } from './pricing'
import PromoForm from './PromoForm'
import PromoDetailModal from './PromoDetailModal'

const CHANNELS = ['Conventional', 'Inbound', 'New Distribution', 'Wholesale', 'Chains', 'eCommerce', 'Retail Direct']
const REGIONS = ['Florida', 'North', 'West', 'East', 'South']
const STATUSES = ['planning', 'approved', 'active', 'completed', 'cancelled']

// Channel colors for promo bars
const CHANNEL_COLORS = {
  'Conventional':       { bar: 'bg-blue-500',      hover: 'hover:bg-blue-600',      text: 'text-white' },
  'Inbound':            { bar: 'bg-cyan-500',      hover: 'hover:bg-cyan-600',      text: 'text-white' },
  'New Distribution':   { bar: 'bg-purple-500',    hover: 'hover:bg-purple-600',    text: 'text-white' },
  'Wholesale':          { bar: 'bg-pink-500',      hover: 'hover:bg-pink-600',      text: 'text-white' },
  'Chains':             { bar: 'bg-amber-500',     hover: 'hover:bg-amber-600',     text: 'text-white' },
  'eCommerce':          { bar: 'bg-emerald-500',   hover: 'hover:bg-emerald-600',   text: 'text-white' },
  'Retail Direct':      { bar: 'bg-rose-500',      hover: 'hover:bg-rose-600',      text: 'text-white' },
}

export default function PromoCalendarPage() {
  const { profile, isManager } = useAuth()
  const { rows: promos }       = useTable('promos_v2')
  const { rows: skuLines }     = useTable('promo_sku_lines')
  const { rows: spendLines }   = useTable('promo_trade_spend_lines')

  // Time window — start with the current quarter, navigable
  const today = new Date()
  const [windowStart, setWindowStart] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    return d
  })
  const [windowMonths, setWindowMonths] = useState(3)

  const [filters, setFilters] = useState({
    channels: new Set(CHANNELS),
    regions: new Set(REGIONS),
    statuses: new Set(['planning', 'approved', 'active']),
  })
  const [showFilters, setShowFilters] = useState(false)

  const [adding, setAdding] = useState(false)
  const [detailFor, setDetailFor] = useState(null)
  const [editing, setEditing] = useState(null)

  // Build time axis — array of { date, label, isToday, isMonthStart }
  const days = useMemo(() => {
    const start = windowStart
    const end = new Date(start.getFullYear(), start.getMonth() + windowMonths, 0)
    const list = []
    const cur = new Date(start)
    while (cur <= end) {
      list.push({
        date: new Date(cur),
        iso: cur.toISOString().slice(0, 10),
        isToday: isSameDay(cur, today),
        isMonthStart: cur.getDate() === 1,
        isWeekStart: cur.getDay() === 1,  // Monday
      })
      cur.setDate(cur.getDate() + 1)
    }
    return list
  }, [windowStart, windowMonths])

  const dayWidth = 18  // px per day in the timeline

  // Filter promos
  const filteredPromos = useMemo(() => {
    return promos.filter((p) => {
      if (!filters.channels.has(p.channel)) return false
      if (!filters.statuses.has(p.status)) return false
      if (p.channel === 'Conventional' && p.regions?.length) {
        // If channel is Conventional, at least one selected region must overlap
        if (!p.regions.some((r) => filters.regions.has(r))) return false
      }
      // Time window overlap
      const winStart = days[0]?.iso
      const winEnd = days[days.length - 1]?.iso
      if (p.end_date < winStart || p.start_date > winEnd) return false
      return true
    })
  }, [promos, filters, days])

  // Group by channel for the swim lanes
  const byChannel = useMemo(() => {
    const m = {}
    for (const ch of CHANNELS) m[ch] = []
    for (const p of filteredPromos) {
      if (m[p.channel]) m[p.channel].push(p)
    }
    return m
  }, [filteredPromos])

  function shiftWindow(months) {
    const d = new Date(windowStart)
    d.setMonth(d.getMonth() + months)
    setWindowStart(d)
  }

  function jumpToToday() {
    setWindowStart(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Promo Calendar</h2>
          <p className="text-sm text-slate-500">
            Click any promo bar to see details. Filter by channel/region/status. Promos roll up case volume to the Forecast Grid when approved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters((s) => !s)} className="btn btn-secondary">
            <Filter size={14} /> Filters
          </button>
          {isManager && (
            <button onClick={() => setAdding(true)} className="btn btn-primary">
              <Plus size={14} /> Add Promo
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <FilterPanel filters={filters} onChange={setFilters} />
      )}

      {/* Timeline navigation */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shiftWindow(-windowMonths)} className="btn btn-secondary !px-2"><ChevronLeft size={14} /></button>
          <button onClick={jumpToToday} className="btn btn-secondary text-xs"><Calendar size={12} /> Today</button>
          <button onClick={() => shiftWindow(windowMonths)} className="btn btn-secondary !px-2"><ChevronRight size={14} /></button>
        </div>
        <div className="text-sm text-slate-600">
          {fmtMonthLong(days[0]?.date)} – {fmtMonthLong(days[days.length - 1]?.date)}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-500">View:</span>
          {[1, 3, 6].map((m) => (
            <button
              key={m}
              onClick={() => setWindowMonths(m)}
              className={classNames(
                'px-2 py-1 rounded',
                windowMonths === m ? 'bg-navy-900 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'
              )}
            >
              {m} mo
            </button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 200 + days.length * dayWidth }}>
            {/* Top header row — month labels then day numbers */}
            <CalendarHeader days={days} dayWidth={dayWidth} />

            {/* Channel swim lanes */}
            {CHANNELS.map((channel) => {
              const items = byChannel[channel] || []
              if (!filters.channels.has(channel)) return null
              return (
                <SwimLane
                  key={channel}
                  channel={channel}
                  items={items}
                  days={days}
                  dayWidth={dayWidth}
                  skuLines={skuLines}
                  spendLines={spendLines}
                  onPromoClick={(p) => setDetailFor(p)}
                />
              )
            })}
            {filteredPromos.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                No promos match the current filters.
                {isManager && (
                  <div className="mt-2">
                    <button onClick={() => setAdding(true)} className="btn btn-primary">
                      <Plus size={14} /> Add the first promo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add promo modal */}
      {adding && (
        <Modal open={true} onClose={() => setAdding(false)} title="New Promo" maxWidth="max-w-5xl">
          <PromoForm
            onClose={() => setAdding(false)}
            onSaved={() => setAdding(false)}
          />
        </Modal>
      )}

      {/* Detail modal */}
      {detailFor && !editing && (
        <Modal open={true} onClose={() => setDetailFor(null)} title=" " maxWidth="max-w-5xl">
          <PromoDetailModal
            promo={detailFor}
            onEdit={() => { setEditing(detailFor); setDetailFor(null) }}
            onClose={() => setDetailFor(null)}
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal open={true} onClose={() => setEditing(null)} title={`Edit: ${editing.name}`} maxWidth="max-w-5xl">
          <PromoForm
            promo={editing}
            onClose={() => setEditing(null)}
            onSaved={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  )
}

// =============================================================================
// Calendar header
// =============================================================================
function CalendarHeader({ days, dayWidth }) {
  // Group days by month for the top header
  const months = []
  let currentMonth = null
  for (const d of days) {
    if (!currentMonth || currentMonth.month !== d.date.getMonth() || currentMonth.year !== d.date.getFullYear()) {
      currentMonth = {
        month: d.date.getMonth(),
        year: d.date.getFullYear(),
        label: d.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        days: 0,
      }
      months.push(currentMonth)
    }
    currentMonth.days += 1
  }

  return (
    <div className="border-b border-slate-200 bg-slate-50">
      {/* Month row */}
      <div className="flex">
        <div className="w-[200px] flex-shrink-0 px-3 py-1.5 border-r border-slate-200 text-xs font-semibold text-slate-700">
          Channel
        </div>
        <div className="flex">
          {months.map((m, i) => (
            <div
              key={i}
              style={{ width: m.days * dayWidth }}
              className="border-r border-slate-200 px-2 py-1.5 text-xs font-display font-semibold text-navy-900"
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>
      {/* Day row — only mark week starts and today */}
      <div className="flex">
        <div className="w-[200px] flex-shrink-0 px-3 py-1 border-r border-slate-200" />
        <div className="flex">
          {days.map((d, i) => (
            <div
              key={i}
              style={{ width: dayWidth }}
              className={classNames(
                'text-[9px] text-center py-1 border-r',
                d.isToday ? 'bg-amber-100 border-amber-300 font-bold text-amber-900' :
                d.isMonthStart ? 'border-slate-300 font-semibold text-slate-700' :
                d.isWeekStart ? 'border-slate-200 text-slate-500' :
                'border-slate-100 text-slate-300'
              )}
            >
              {(d.isMonthStart || d.isWeekStart || d.isToday) ? d.date.getDate() : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Swim lane — one channel's row
// =============================================================================
function SwimLane({ channel, items, days, dayWidth, skuLines, spendLines, onPromoClick }) {
  const lanes = stackPromos(items)
  const laneHeight = 28
  const totalHeight = Math.max(laneHeight, lanes.length * (laneHeight + 4) + 6)
  const colors = CHANNEL_COLORS[channel] || CHANNEL_COLORS['Conventional']

  return (
    <div className="flex border-b border-slate-100" style={{ minHeight: totalHeight }}>
      <div className="w-[200px] flex-shrink-0 px-3 py-2 border-r border-slate-200 bg-slate-50/50">
        <div className="font-display font-semibold text-sm">{channel}</div>
        <div className="text-[10px] text-slate-500">{items.length} promo{items.length === 1 ? '' : 's'}</div>
      </div>
      <div className="relative flex-grow" style={{ width: days.length * dayWidth }}>
        {/* Vertical day grid */}
        <div className="absolute inset-0 flex pointer-events-none">
          {days.map((d, i) => (
            <div
              key={i}
              style={{ width: dayWidth }}
              className={classNames(
                'border-r',
                d.isToday ? 'bg-amber-50/40 border-amber-200' :
                d.isMonthStart ? 'border-slate-300' :
                d.isWeekStart ? 'border-slate-100' :
                'border-slate-50'
              )}
            />
          ))}
        </div>
        {/* Promo bars */}
        {lanes.map((laneItems, laneIdx) => (
          <div key={laneIdx} style={{ position: 'absolute', top: 4 + laneIdx * (laneHeight + 4), left: 0, right: 0, height: laneHeight }}>
            {laneItems.map((p) => {
              const startIdx = days.findIndex((d) => d.iso >= p.start_date)
              const endIdx = days.findIndex((d) => d.iso > p.end_date)
              const left = (startIdx === -1 ? 0 : startIdx) * dayWidth
              const widthDays = (endIdx === -1 ? days.length : endIdx) - (startIdx === -1 ? 0 : startIdx)
              const width = Math.max(dayWidth, widthDays * dayWidth - 2)
              const promoLines = skuLines.filter((l) => l.promo_id === p.id)
              const promoSpends = spendLines.filter((l) => l.promo_id === p.id)
              const totals = computePromoTotals(p, promoLines, promoSpends)
              return (
                <button
                  key={p.id}
                  onClick={() => onPromoClick(p)}
                  className={classNames(
                    'absolute top-0 rounded shadow-sm overflow-hidden text-xs px-2 py-1 truncate text-left transition-shadow',
                    colors.bar, colors.hover, colors.text,
                    'hover:shadow-md cursor-pointer',
                    p.status === 'planning' && 'opacity-70',
                    p.status === 'cancelled' && 'opacity-40 line-through',
                    p.status === 'completed' && 'opacity-60',
                  )}
                  style={{ left, width, height: laneHeight }}
                  title={`${p.name} — ${fmtCompactCurrency(totals.gross_revenue)} gross / ${fmtCompactCurrency(totals.contribution_profit)} CP`}
                >
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-[9px] opacity-90 truncate">
                    {fmtCompactCurrency(totals.gross_revenue)} · {totals.total_cases.toLocaleString('en-US', { maximumFractionDigits: 0 })} cs
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Filter panel
// =============================================================================
function FilterPanel({ filters, onChange }) {
  function toggleSet(setName, val) {
    const next = new Set(filters[setName])
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange({ ...filters, [setName]: next })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card p-3">
      <div className="grid md:grid-cols-3 gap-4">
        <FilterGroup
          label="Channels"
          all={CHANNELS}
          selected={filters.channels}
          onToggle={(v) => toggleSet('channels', v)}
        />
        <FilterGroup
          label="Conventional Regions"
          all={REGIONS}
          selected={filters.regions}
          onToggle={(v) => toggleSet('regions', v)}
        />
        <FilterGroup
          label="Status"
          all={STATUSES}
          selected={filters.statuses}
          onToggle={(v) => toggleSet('statuses', v)}
        />
      </div>
    </div>
  )
}

function FilterGroup({ label, all, selected, onToggle }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1">
        {all.map((v) => (
          <button
            key={v}
            onClick={() => onToggle(v)}
            className={classNames(
              'px-2 py-1 text-xs rounded border',
              selected.has(v)
                ? 'bg-navy-900 text-white border-navy-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function fmtMonthLong(d) {
  if (!d) return ''
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Stack overlapping promos into multiple lanes within a swim row.
 * Returns array of arrays — each inner array is one lane's promos.
 */
function stackPromos(promos) {
  const sorted = [...promos].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const lanes = []
  for (const p of sorted) {
    let placed = false
    for (const lane of lanes) {
      const last = lane[lane.length - 1]
      if (last.end_date < p.start_date) {
        lane.push(p)
        placed = true
        break
      }
    }
    if (!placed) lanes.push([p])
  }
  return lanes
}
