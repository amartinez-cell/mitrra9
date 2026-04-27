/**
 * DistributorTargetsTab — manager-only editable grid of 12 months per
 * distributor. Mirrors the Book4 dp_targets sheet shape. Yearly column shows
 * sum-of-monthly automatically; managers can edit any cell.
 */

import { useMemo } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { useAuth } from '../../hooks/useAuth'
import { mockStore } from '../../data/mockStore'
import { classNames } from '../../lib/format'
import EditableCell from './EditableCell'
import { fmtCell, fmtCompactDollar, MONTH_NAMES, FY } from './helpers'

const REGION_ORDER = ['Florida', 'North', 'West', 'East', 'South']
const CHANNEL_ORDER = ['Conventional', 'Inbound', 'New Distribution', 'Wholesale', 'Chains']

export default function DistributorTargetsTab() {
  const { profile } = useAuth()
  const { rows: distributors } = useTable('distributors')
  const { rows: regions }      = useTable('regions')
  const { rows: targets }      = useTable('distributor_targets')

  const [collapsed, setCollapsed] = useState({})

  // Index targets for quick lookup
  const targetByKey = useMemo(() => {
    const m = new Map()
    for (const t of targets) {
      if (t.fiscal_year !== FY) continue
      m.set(`${t.distributor_id}|${t.month}`, t)
    }
    return m
  }, [targets])

  const regionById = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions])

  // Build sections similar to ForecastGrid
  const sections = useMemo(() => {
    const out = []
    // Conventional, by region
    for (const regionName of REGION_ORDER) {
      const region = regions.find((r) => r.name === regionName)
      if (!region) continue
      const dists = distributors
        .filter((d) => d.channel === 'Conventional' && d.region_id === region.id && d.row_kind === 'partner')
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      out.push({ key: `conv-${regionName}`, label: regionName, channel: 'Conventional', dists })
    }
    for (const channel of CHANNEL_ORDER.slice(1)) {
      const dists = distributors
        .filter((d) => d.channel === channel && d.row_kind === 'partner')
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      if (dists.length) out.push({ key: `ch-${channel}`, label: channel, channel, dists })
    }
    return out
  }, [distributors, regions])

  function getMonth(distId, month) {
    return Number(targetByKey.get(`${distId}|${month}`)?.target_revenue || 0)
  }

  function setMonth(distId, month, val) {
    const existing = targetByKey.get(`${distId}|${month}`)
    if (existing) {
      mockStore.update('distributor_targets', existing.id, {
        target_revenue: val,
        set_by: profile.id,
        set_at: new Date().toISOString(),
      })
    } else {
      mockStore.insert('distributor_targets', {
        distributor_id: distId,
        fiscal_year: FY,
        month,
        target_revenue: val,
        set_by: profile.id,
        set_at: new Date().toISOString(),
      })
    }
    mockStore.log('updated', 'distributor_targets', distId, { month, target_revenue: val }, profile)
  }

  function rowYearly(distId) {
    let s = 0
    for (let m = 1; m <= 12; m++) s += getMonth(distId, m)
    return s
  }

  function sectionMonthly(dists) {
    const t = Array(13).fill(0)  // index 0 unused
    for (const d of dists) {
      for (let m = 1; m <= 12; m++) t[m] += getMonth(d.id, m)
    }
    return t
  }

  // Grand totals across all sections
  const grandMonthly = useMemo(() => {
    const t = Array(13).fill(0)
    for (const sect of sections) {
      const sm = sectionMonthly(sect.dists)
      for (let m = 1; m <= 12; m++) t[m] += sm[m]
    }
    return t
  }, [sections, targets])

  const grandYearly = grandMonthly.reduce((a, b) => a + b, 0)

  function toggle(key) {
    setCollapsed((s) => ({ ...s, [key]: !s[key] }))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="text-sm text-slate-600">
          Editable annual plan per distributor. Yearly column = sum of monthly cells. Changes flow through to the Reforecast Grid as the new "Plan" reference.
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">FY{FY} Total Plan</div>
          <div className="font-display text-xl font-semibold">{fmtCompactDollar(grandYearly)}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-x-auto">
        <table className="text-xs whitespace-nowrap" style={{ minWidth: '1400px' }}>
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 6 }} />
            {Array.from({ length: 12 }).map((_, i) => <col key={i} style={{ width: 84 }} />)}
          </colgroup>
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="border-b border-slate-200">
              <th className="text-left px-2 py-2 font-semibold text-slate-700">Distributor</th>
              <th className="text-left px-2 py-2 font-semibold text-slate-700">Lead</th>
              <th className="text-right px-2 py-2 font-semibold text-slate-700">Yearly</th>
              <th></th>
              {MONTH_NAMES.map((m) => (
                <th key={m} className="text-right px-2 py-2 font-semibold text-slate-700">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((sect, idx) => {
              const prevChannel = idx > 0 ? sections[idx - 1].channel : null
              const showChannelHeader = prevChannel !== sect.channel
              const sectMonthly = sectionMonthly(sect.dists)
              const sectYearly = sectMonthly.reduce((a, b) => a + b, 0)
              return (
                <tbody key={sect.key} className="contents">
                  {showChannelHeader && (
                    <tr className="bg-navy-900 text-white">
                      <td colSpan={16} className="px-3 py-2 font-display font-semibold tracking-wide">
                        {sect.channel}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 border-t border-slate-200">
                    <td colSpan={3} className="px-2 py-1.5">
                      <button
                        onClick={() => toggle(sect.key)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-navy-900"
                      >
                        {collapsed[sect.key] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        {sect.label}
                        <span className="text-slate-400 normal-case font-normal">· {sect.dists.length} partners</span>
                      </button>
                    </td>
                    <td colSpan={13}></td>
                  </tr>

                  {!collapsed[sect.key] && (
                    <>
                      {sect.dists.map((d) => (
                        <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-2 py-1 font-medium truncate" title={d.name}>{d.name}</td>
                          <td className="px-2 py-1 text-slate-500 text-[11px] truncate">{d.lead_name || '—'}</td>
                          <td className="text-right px-2 py-1 font-mono font-semibold">{fmtCell(rowYearly(d.id))}</td>
                          <td></td>
                          {Array.from({ length: 12 }).map((_, i) => {
                            const m = i + 1
                            return (
                              <td key={m} className="text-right px-1 py-0.5 font-mono">
                                <EditableCell
                                  value={getMonth(d.id, m)}
                                  onCommit={(v) => setMonth(d.id, m, v)}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))}

                      {/* Section subtotal */}
                      <tr className="bg-slate-100 border-y border-slate-200 font-medium">
                        <td className="px-2 py-1.5" colSpan={2}>{sect.label} Subtotal</td>
                        <td className="text-right px-2 py-1.5 font-mono font-semibold">{fmtCell(sectYearly)}</td>
                        <td></td>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <td key={i+1} className="text-right px-2 py-1.5 font-mono">{fmtCell(sectMonthly[i+1])}</td>
                        ))}
                      </tr>
                    </>
                  )}
                </tbody>
              )
            })}

            {/* Grand total */}
            <tr className="bg-navy-900 text-white font-display font-semibold border-t-2 border-navy-700">
              <td className="px-2 py-2.5" colSpan={2}>GRAND TOTAL</td>
              <td className="text-right px-2 py-2.5 font-mono">{fmtCell(grandYearly)}</td>
              <td></td>
              {Array.from({ length: 12 }).map((_, i) => (
                <td key={i+1} className="text-right px-2 py-2.5 font-mono">{fmtCell(grandMonthly[i+1])}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
