/**
 * ForecastGrid — Excel-like editing grid for the monthly reforecast.
 *
 * Visual structure (per section):
 *   ┌─ Region/Channel header (sticky)
 *   ├─ Distributor Partner rows (editable forward months)
 *   ├─ "Other" rolled-up row
 *   ├─ Subtotal row
 *   ├─ MTD Landed line (read-only, from BigQuery)
 *   ├─ R&O / Go Gets rows (synthesized from incremental ro_items)
 *   └─ Subtotal + Go Gets row
 */

import { useMemo, useState } from 'react'
import {
  ChevronDown, ChevronRight, Download,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTable } from '../../hooks/useTable'
import { useAsync } from '../../hooks/useAsync'
import { fetchByDistributor } from '../../lib/bigqueryApi'
import { mockStore } from '../../data/mockStore'
import { classNames } from '../../lib/format'
import {
  fmtCell, fmtCompactDollar, fmtCellSigned, periodState,
  MONTH_NAMES, FY, DEMO_CURRENT_MONTH,
} from './helpers'
import { useForecastGrid } from './useForecastGrid'
import { exportForecastToXlsx } from './exportXlsx'
import EditableCell from '../targets/EditableCell'

const COL_WIDTHS = {
  partner: 180,
  lead: 100,
  mtd: 80,
  variance: 80,
  month: 72,
  total: 90,
  plan: 88,
  varDollar: 80,
  varPct: 60,
}

export default function ForecastGrid({ fiscalYear = FY }) {
  const { profile, isManager } = useAuth()
  const [collapsed, setCollapsed] = useState({})
  const [savingFlash, setSavingFlash] = useState(new Set())

  // Pull MTD actuals once per render (in mock mode this returns seeded data)
  const { data: actualsData } = useAsync(
    () => fetchByDistributor(fiscalYear, DEMO_CURRENT_MONTH),
    [fiscalYear]
  )
  const mtdActualsByDistributor = useMemo(() => {
    const map = {}
    if (actualsData?.rows) {
      // Match by name → distributor id from store
      const dists = mockStore.list('distributors')
      for (const a of actualsData.rows) {
        const d = dists.find((dd) => dd.name === a.distributor)
        if (d) map[d.id] = a.revenue
      }
    }
    return map
  }, [actualsData])

  const { sections, channelTotals, grandTotals } = useForecastGrid({
    fiscalYear,
    currentMonth: DEMO_CURRENT_MONTH,
    mtdActualsByDistributor,
  })

  function handleCellEdit(distributor_id, month, val) {
    if (val === null || val === undefined) return
    mockStore.upsertForecastCell({
      distributor_id, fiscal_year: fiscalYear, month, forecasted_revenue: val,
    }, profile)
    // Visual flash
    const key = `${distributor_id}|${month}`
    setSavingFlash((s) => { const n = new Set(s); n.add(key); return n })
    setTimeout(() => setSavingFlash((s) => { const n = new Set(s); n.delete(key); return n }), 600)
    mockStore.log('updated', 'forecast_cells', null, {
      distributor_id, month,
    }, profile)
  }

  function toggleSection(key) {
    setCollapsed((s) => ({ ...s, [key]: !s[key] }))
  }

  function handleExport() {
    exportForecastToXlsx({ sections, channelTotals, grandTotals, fiscalYear })
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Monthly Reforecast Grid</h2>
          <p className="text-sm text-slate-500">
            Past months are read-only actuals from BigQuery. Edit forward months directly — Tab to next cell, Enter to next row.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-slate-500">FY{fiscalYear} Reforecast</div>
            <div className="font-display text-xl font-semibold">{fmtCompactDollar(grandTotals.reforecastTotal)}</div>
          </div>
          <div className="text-right pl-3 border-l border-slate-200">
            <div className="text-xs text-slate-500">Plan</div>
            <div className="font-display text-xl font-semibold text-slate-600">{fmtCompactDollar(grandTotals.targetTotal)}</div>
          </div>
          <div className={classNames('text-right pl-3 border-l border-slate-200',
            grandTotals.varDollar >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
            <div className="text-xs text-slate-500">Variance</div>
            <div className="font-display text-xl font-semibold">
              {grandTotals.varDollar >= 0 ? '+' : ''}{fmtCompactDollar(grandTotals.varDollar)}
            </div>
          </div>
          <button onClick={handleExport} className="btn btn-secondary ml-3">
            <Download size={14} /> Export to Excel
          </button>
        </div>
      </div>

      {/* The grid */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-x-auto">
        <table className="text-xs whitespace-nowrap" style={{ minWidth: '1500px' }}>
          <colgroup>
            <col style={{ width: COL_WIDTHS.partner }} />
            <col style={{ width: COL_WIDTHS.lead }} />
            <col style={{ width: COL_WIDTHS.mtd }} />
            <col style={{ width: COL_WIDTHS.variance }} />
            <col style={{ width: 6 }} /> {/* divider */}
            {Array.from({ length: 12 }).map((_, i) => (
              <col key={i} style={{ width: COL_WIDTHS.month }} />
            ))}
            <col style={{ width: 6 }} />
            <col style={{ width: COL_WIDTHS.total }} />
            <col style={{ width: COL_WIDTHS.plan }} />
            <col style={{ width: COL_WIDTHS.varDollar }} />
            <col style={{ width: COL_WIDTHS.varPct }} />
          </colgroup>

          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="border-b border-slate-200">
              <th className="text-left px-2 py-2 font-semibold text-slate-700">Distribution Partner</th>
              <th className="text-left px-2 py-2 font-semibold text-slate-700">Lead</th>
              <th className="text-right px-2 py-2 font-semibold text-slate-700">Current MTD</th>
              <th className="text-right px-2 py-2 font-semibold text-slate-700">vs FCST</th>
              <th></th>
              {MONTH_NAMES.map((m, i) => (
                <th
                  key={m}
                  className={classNames(
                    'text-right px-2 py-2 font-semibold',
                    periodState(i + 1) === 'past' ? 'text-slate-400' :
                    periodState(i + 1) === 'current' ? 'text-amber-700' : 'text-slate-700'
                  )}
                >
                  {m}
                </th>
              ))}
              <th></th>
              <th className="text-right px-2 py-2 font-semibold text-slate-700">Reforecast</th>
              <th className="text-right px-2 py-2 font-semibold text-slate-700">Plan</th>
              <th className="text-right px-2 py-2 font-semibold text-slate-700">Var $</th>
              <th className="text-right px-2 py-2 font-semibold text-slate-700">Var %</th>
            </tr>
          </thead>

          <tbody>
            {sections.map((sect, sectIdx) => {
              // Print a channel divider before the first section of a new channel
              const prevChannel = sectIdx > 0 ? sections[sectIdx - 1].channel : null
              const showChannelHeader = prevChannel !== sect.channel
              return (
                <SectionGroup
                  key={sect.key}
                  section={sect}
                  showChannelHeader={showChannelHeader}
                  channelTotals={channelTotals}
                  collapsed={!!collapsed[sect.key]}
                  onToggle={() => toggleSection(sect.key)}
                  onCellEdit={handleCellEdit}
                  savingFlash={savingFlash}
                  isManager={isManager}
                  currentUserRepId={profile.id}
                />
              )
            })}

            {/* Grand total */}
            <GrandTotalRow grandTotals={grandTotals} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// SectionGroup — one channel/region block with all its rows + subtotals
// =============================================================================
function SectionGroup({
  section, showChannelHeader, channelTotals, collapsed, onToggle,
  onCellEdit, savingFlash, isManager, currentUserRepId,
}) {
  return (
    <>
      {showChannelHeader && (
        <tr className="bg-navy-900 text-white">
          <td colSpan={18} className="px-3 py-2 font-display font-semibold tracking-wide">
            {section.channel}
          </td>
        </tr>
      )}

      {/* Region/Section header */}
      <tr className="bg-slate-100 border-t border-slate-200">
        <td colSpan={4} className="px-2 py-1.5">
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-navy-900"
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            {section.label}
            <span className="text-slate-400 normal-case font-normal">
              · {section.partnerRows.length + section.otherRows.length} partner{(section.partnerRows.length + section.otherRows.length) === 1 ? '' : 's'}
            </span>
          </button>
        </td>
        <td></td>
        <td colSpan={12}></td>
        <td></td>
        <td colSpan={4}></td>
      </tr>

      {!collapsed && (
        <>
          {/* Partner rows */}
          {section.partnerRows.map((row) => (
            <DistributorRow
              key={row.distributor.id}
              row={row}
              onCellEdit={onCellEdit}
              savingFlash={savingFlash}
              canEdit={isManager || row.distributor.owner_rep_id === currentUserRepId}
            />
          ))}

          {/* Other rows (rolled-up small partners) */}
          {section.otherRows.map((row) => (
            <DistributorRow
              key={row.distributor.id}
              row={row}
              onCellEdit={onCellEdit}
              savingFlash={savingFlash}
              canEdit={isManager || row.distributor.owner_rep_id === currentUserRepId}
            />
          ))}

          {/* Subtotal (partners + other) */}
          <SubtotalRow
            label={`${section.label} Subtotal`}
            totals={section.partnerSubtotals}
            tone="muted"
          />

          {/* MTD landed line */}
          {section.mtdLanded > 0 && (
            <tr className="bg-amber-50/40 border-y border-amber-100">
              <td className="px-2 py-1.5 italic text-amber-800" colSpan={2}>
                <span className="font-medium">MTD Landed</span>
                <span className="text-amber-600 ml-1.5 text-[11px]">live from BigQuery</span>
              </td>
              <td className="text-right px-2 py-1.5 font-mono font-semibold">{fmtCell(section.mtdLanded)}</td>
              <td colSpan={15}></td>
            </tr>
          )}

          {/* Go Gets section header */}
          {section.goGetRows.length > 0 && (
            <tr className="bg-emerald-50/40">
              <td colSpan={18} className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-emerald-700">
                Go Gets ({section.goGetRows.length})
              </td>
            </tr>
          )}
          {section.goGetRows.map((row) => (
            <DistributorRow
              key={row.distributor.id}
              row={row}
              onCellEdit={onCellEdit}
              savingFlash={savingFlash}
              canEdit={false /* Go Gets are sourced from R&O — edit there */}
              isGoGet={true}
            />
          ))}

          {/* Subtotal + Go Gets — only show if there are Go Gets */}
          {section.goGetRows.length > 0 && (
            <SubtotalRow
              label={`${section.label} + Go Gets`}
              totals={section.subtotalsWithGoGets}
              tone="strong"
            />
          )}
        </>
      )}
    </>
  )
}

// =============================================================================
// Distributor row — partner / other / go_get
// =============================================================================
function DistributorRow({ row, onCellEdit, savingFlash, canEdit, isGoGet }) {
  const d = row.distributor
  return (
    <tr className={classNames(
      'border-t border-slate-100 hover:bg-slate-50 group',
      d.row_kind === 'other' && 'bg-slate-50/40 italic',
      isGoGet && 'bg-emerald-50/20'
    )}>
      <td className="px-2 py-1 truncate font-medium" title={d.name}>
        {isGoGet && <span className="text-emerald-700 mr-1">↗</span>}
        {d.name}
      </td>
      <td className="px-2 py-1 truncate text-slate-500 text-[11px]">{d.lead_name || '—'}</td>
      <td className="text-right px-2 py-1 font-mono">{fmtCell(row.mtdActual)}</td>
      <td className={classNames(
        'text-right px-2 py-1 font-mono text-[11px]',
        row.mtdActual >= (row.months[3]?.forecasted || 0) ? 'text-emerald-700' : 'text-slate-500'
      )}>
        {row.mtdActual > 0 && row.months[3]?.forecasted > 0
          ? fmtCellSigned(row.mtdActual - row.months[3].forecasted)
          : '—'}
      </td>
      <td></td>
      {row.months.map((m) => {
        const ps = periodState(m.month)
        const isFlash = savingFlash.has(`${d.id}|${m.month}`)
        return (
          <td
            key={m.month}
            className={classNames(
              'text-right px-1 py-0.5 font-mono',
              ps === 'past' && 'bg-slate-50 text-slate-500',
              ps === 'current' && 'bg-amber-50 text-amber-900',
              ps === 'future' && 'bg-white',
              isFlash && '!bg-blue-100 transition-colors',
            )}
          >
            <EditableCell
              value={m.forecasted}
              readOnly={ps !== 'future' || !canEdit}
              onCommit={(raw) => onCellEdit(d.id, m.month, raw)}
            />
          </td>
        )
      })}
      <td></td>
      <td className="text-right px-2 py-1 font-mono font-semibold">{fmtCell(row.reforecastTotal)}</td>
      <td className="text-right px-2 py-1 font-mono text-slate-500">{fmtCell(row.targetTotal)}</td>
      <td className={classNames(
        'text-right px-2 py-1 font-mono',
        row.varDollar >= 0 ? 'text-emerald-700' : 'text-rose-700'
      )}>
        {fmtCellSigned(row.varDollar)}
      </td>
      <td className={classNames(
        'text-right px-2 py-1 font-mono',
        row.varPct == null ? 'text-slate-400' :
        row.varPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
      )}>
        {row.varPct == null ? '—' : `${(row.varPct * 100).toFixed(0)}%`}
      </td>
    </tr>
  )
}

// =============================================================================
// Subtotal & total rows
// =============================================================================
function SubtotalRow({ label, totals, tone = 'muted' }) {
  return (
    <tr className={classNames(
      'border-y',
      tone === 'strong' ? 'bg-navy-50 border-navy-200 font-semibold' : 'bg-slate-100 border-slate-200 font-medium'
    )}>
      <td className="px-2 py-1.5" colSpan={4}>{label}</td>
      <td></td>
      {Array.from({ length: 12 }).map((_, i) => {
        const m = i + 1
        const v = totals.byMonth[m] || 0
        return (
          <td key={m} className="text-right px-2 py-1.5 font-mono">
            {fmtCell(v)}
          </td>
        )
      })}
      <td></td>
      <td className="text-right px-2 py-1.5 font-mono">{fmtCell(totals.reforecastTotal)}</td>
      <td className="text-right px-2 py-1.5 font-mono text-slate-500">{fmtCell(totals.targetTotal)}</td>
      <td className={classNames(
        'text-right px-2 py-1.5 font-mono',
        totals.varDollar >= 0 ? 'text-emerald-700' : 'text-rose-700'
      )}>
        {fmtCellSigned(totals.varDollar)}
      </td>
      <td className={classNames(
        'text-right px-2 py-1.5 font-mono',
        totals.varPct == null ? 'text-slate-400' :
        totals.varPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
      )}>
        {totals.varPct == null ? '—' : `${(totals.varPct * 100).toFixed(0)}%`}
      </td>
    </tr>
  )
}

function GrandTotalRow({ grandTotals }) {
  return (
    <tr className="bg-navy-900 text-white font-display font-semibold border-t-2 border-navy-700">
      <td className="px-2 py-2.5" colSpan={4}>GRAND TOTAL</td>
      <td></td>
      {Array.from({ length: 12 }).map((_, i) => {
        const m = i + 1
        return (
          <td key={m} className="text-right px-2 py-2.5 font-mono">
            {fmtCell(grandTotals.byMonth[m])}
          </td>
        )
      })}
      <td></td>
      <td className="text-right px-2 py-2.5 font-mono">{fmtCell(grandTotals.reforecastTotal)}</td>
      <td className="text-right px-2 py-2.5 font-mono text-white/70">{fmtCell(grandTotals.targetTotal)}</td>
      <td className={classNames(
        'text-right px-2 py-2.5 font-mono',
        grandTotals.varDollar >= 0 ? 'text-emerald-300' : 'text-rose-300'
      )}>
        {fmtCellSigned(grandTotals.varDollar)}
      </td>
      <td className={classNames(
        'text-right px-2 py-2.5 font-mono',
        grandTotals.varPct == null ? 'text-white/50' :
        grandTotals.varPct >= 0 ? 'text-emerald-300' : 'text-rose-300'
      )}>
        {grandTotals.varPct == null ? '—' : `${(grandTotals.varPct * 100).toFixed(0)}%`}
      </td>
    </tr>
  )
}
