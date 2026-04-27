/**
 * RepTargetsTab — manager-only editable grid of rep × month total revenue.
 * Per business request, only total revenue is tracked here (no Seltzer/Shots
 * or case-count breakdowns). Reps are grouped by channel.
 */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTable } from '../../hooks/useTable'
import { useAuth } from '../../hooks/useAuth'
import { mockStore } from '../../data/mockStore'
import EditableCell from './EditableCell'
import { fmtCell, fmtCompactDollar, MONTH_NAMES, FY } from './helpers'

const CHANNEL_ORDER = ['Conventional', 'Inbound', 'New Distribution', 'Wholesale', 'Chains']
const REGION_ORDER = ['Florida', 'North', 'West', 'East', 'South']

export default function RepTargetsTab() {
  const { profile }            = useAuth()
  const { rows: profiles }     = useTable('profiles')
  const { rows: repTargets }   = useTable('rep_targets')
  const { rows: regions }      = useTable('regions')
  const [collapsed, setCollapsed] = useState({})

  const targetByKey = useMemo(() => {
    const m = new Map()
    for (const t of repTargets) {
      if (t.fiscal_year !== FY) continue
      m.set(`${t.rep_id}|${t.month}`, t)
    }
    return m
  }, [repTargets])

  // Reps grouped by channel (Conventional further by region)
  const sections = useMemo(() => {
    const out = []
    for (const channel of CHANNEL_ORDER) {
      const reps = profiles.filter(
        (p) => p.role === 'rep' && p.sales_channel === channel
      )
      if (channel === 'Conventional') {
        for (const region of REGION_ORDER) {
          const r = reps.filter((rp) => rp.sales_region === region)
            .sort((a, b) => a.full_name.localeCompare(b.full_name))
          if (r.length) out.push({ key: `conv-${region}`, label: region, channel, reps: r })
        }
      } else {
        const sorted = reps.sort((a, b) => a.full_name.localeCompare(b.full_name))
        if (sorted.length) out.push({ key: `ch-${channel}`, label: channel, channel, reps: sorted })
      }
    }
    return out
  }, [profiles])

  function getMonth(repId, month) {
    return Number(targetByKey.get(`${repId}|${month}`)?.target_revenue || 0)
  }

  function setMonth(repId, month, val) {
    const existing = targetByKey.get(`${repId}|${month}`)
    if (existing) {
      mockStore.update('rep_targets', existing.id, {
        target_revenue: val,
        set_by: profile.id,
        set_at: new Date().toISOString(),
      })
    } else {
      mockStore.insert('rep_targets', {
        rep_id: repId, fiscal_year: FY, month, target_revenue: val,
        set_by: profile.id, set_at: new Date().toISOString(),
      })
    }
    mockStore.log('updated', 'rep_targets', repId, { month, target_revenue: val }, profile)
  }

  function repYearly(repId) {
    let s = 0
    for (let m = 1; m <= 12; m++) s += getMonth(repId, m)
    return s
  }

  function sectionMonthly(reps) {
    const t = Array(13).fill(0)
    for (const r of reps) for (let m = 1; m <= 12; m++) t[m] += getMonth(r.id, m)
    return t
  }

  // Channel-level totals
  const channelTotals = useMemo(() => {
    const out = {}
    for (const ch of CHANNEL_ORDER) {
      const sm = Array(13).fill(0)
      for (const sect of sections) {
        if (sect.channel !== ch) continue
        const m = sectionMonthly(sect.reps)
        for (let i = 1; i <= 12; i++) sm[i] += m[i]
      }
      out[ch] = sm
    }
    return out
  }, [sections, repTargets])

  const grandMonthly = useMemo(() => {
    const t = Array(13).fill(0)
    for (const sect of sections) {
      const sm = sectionMonthly(sect.reps)
      for (let i = 1; i <= 12; i++) t[i] += sm[i]
    }
    return t
  }, [sections, repTargets])
  const grandYearly = grandMonthly.reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="text-sm text-slate-600">
          Total revenue target per rep per month. Used for individual rep performance tracking — only Chains, New Distribution, and Wholesale segments show in the dashboard.
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">FY{FY} Rep Plan Total</div>
          <div className="font-display text-xl font-semibold">{fmtCompactDollar(grandYearly)}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-x-auto">
        <table className="text-xs whitespace-nowrap" style={{ minWidth: '1300px' }}>
          <colgroup>
            <col style={{ width: 200 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 6 }} />
            {Array.from({ length: 12 }).map((_, i) => <col key={i} style={{ width: 84 }} />)}
          </colgroup>
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="border-b border-slate-200">
              <th className="text-left px-2 py-2 font-semibold text-slate-700">Sales Rep</th>
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
              const sectMonthly = sectionMonthly(sect.reps)
              const sectYearly = sectMonthly.reduce((a, b) => a + b, 0)
              const isLastInChannel = idx === sections.length - 1 || sections[idx + 1].channel !== sect.channel
              const ch = sect.channel
              return (
                <tbody key={sect.key} className="contents">
                  {showChannelHeader && (
                    <tr className="bg-navy-900 text-white">
                      <td colSpan={15} className="px-3 py-2 font-display font-semibold tracking-wide">
                        {sect.channel}
                      </td>
                    </tr>
                  )}
                  {/* Section header (region or channel) */}
                  <tr className="bg-slate-100 border-t border-slate-200">
                    <td colSpan={2} className="px-2 py-1.5">
                      <button
                        onClick={() => setCollapsed((s) => ({ ...s, [sect.key]: !s[sect.key] }))}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-navy-900"
                      >
                        {collapsed[sect.key] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        {sect.label}
                        <span className="text-slate-400 normal-case font-normal">· {sect.reps.length} reps</span>
                      </button>
                    </td>
                    <td colSpan={13}></td>
                  </tr>
                  {!collapsed[sect.key] && (
                    <>
                      {sect.reps.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-2 py-1 font-medium">{r.full_name}</td>
                          <td className="text-right px-2 py-1 font-mono font-semibold">{fmtCell(repYearly(r.id))}</td>
                          <td></td>
                          {Array.from({ length: 12 }).map((_, i) => (
                            <td key={i+1} className="text-right px-1 py-0.5 font-mono">
                              <EditableCell
                                value={getMonth(r.id, i+1)}
                                onCommit={(v) => setMonth(r.id, i+1, v)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="bg-slate-100 border-y border-slate-200 font-medium">
                        <td className="px-2 py-1.5">{sect.label} Subtotal</td>
                        <td className="text-right px-2 py-1.5 font-mono">{fmtCell(sectYearly)}</td>
                        <td></td>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <td key={i+1} className="text-right px-2 py-1.5 font-mono">{fmtCell(sectMonthly[i+1])}</td>
                        ))}
                      </tr>
                    </>
                  )}

                  {/* Channel-level subtotal printed after the last section in this channel */}
                  {isLastInChannel && (
                    <tr className="bg-navy-50 border-y border-navy-200 font-semibold">
                      <td className="px-2 py-1.5">{ch} Total</td>
                      <td className="text-right px-2 py-1.5 font-mono">{fmtCell(channelTotals[ch].reduce((a,b)=>a+b,0))}</td>
                      <td></td>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <td key={i+1} className="text-right px-2 py-1.5 font-mono">{fmtCell(channelTotals[ch][i+1])}</td>
                      ))}
                    </tr>
                  )}
                </tbody>
              )
            })}

            <tr className="bg-navy-900 text-white font-display font-semibold border-t-2 border-navy-700">
              <td className="px-2 py-2.5">GRAND TOTAL</td>
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
