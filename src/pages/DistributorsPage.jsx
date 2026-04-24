import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Plus, AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTable, insertRow } from '../hooks/useTable'
import { useAsync } from '../hooks/useAsync'
import { fetchByDistributor } from '../lib/bigqueryApi'
import { Card, Tag, EmptyState } from '../components/ui/Primitives'
import { fmtCompactCurrency, fmtPct, ragColor, classNames, monthName, MONTHS } from '../lib/format'

const FY = 2026

export default function DistributorsPage() {
  const { profile, isManager } = useAuth()
  const [month, setMonth] = useState(4)
  const { rows: targets }      = useTable('distributor_targets')
  const { rows: roItems }      = useTable('ro_items')
  const { data: actualsData }  = useAsync(() => fetchByDistributor(FY, month), [month])

  const rows = useMemo(() => {
    if (!actualsData) return []
    const targetByName = {}
    for (const t of targets) {
      if (t.fiscal_year === FY && t.month === month) {
        targetByName[t.distributor_name] = { target: Number(t.target_revenue), region: t.sales_region }
      }
    }
    const actuals = actualsData.rows || []
    const names = new Set([...actuals.map((a) => a.distributor), ...Object.keys(targetByName)])
    return Array.from(names).map((name) => {
      const actual = actuals.find((a) => a.distributor === name)
      const tgt = targetByName[name] || {}
      const actualRev = actual?.revenue || 0
      const pctPlan = tgt.target ? actualRev / tgt.target : null
      return {
        distributor: name,
        region: tgt.region || '—',
        actual: actualRev,
        target: tgt.target || 0,
        pctPlan,
        units: actual?.units || 0,
        fillRate: actual?.fill_rate ?? null,
        orderFrequency: actual?.order_frequency ?? null,
        rag: pctPlan == null ? 'slate' :
             pctPlan >= 1    ? 'green' :
             pctPlan >= 0.80 ? 'amber' : 'red',
      }
    }).sort((a, b) => (b.target || 0) - (a.target || 0))
  }, [actualsData, targets, month])

  // Bucket into over / on / under
  const overperformers  = rows.filter((r) => r.pctPlan != null && r.pctPlan >= 1)
  const onTrack         = rows.filter((r) => r.pctPlan != null && r.pctPlan >= 0.80 && r.pctPlan < 1)
  const underperformers = rows.filter((r) => r.pctPlan != null && r.pctPlan < 0.80)

  const totals = rows.reduce((a, r) => ({
    actual: a.actual + r.actual,
    target: a.target + r.target,
  }), { actual: 0, target: 0 })

  const netVariance = totals.actual - totals.target

  // Find distributors already flagged in R&O
  const flaggedInRO = useMemo(() => {
    const flagged = new Set()
    for (const r of roItems) {
      for (const d of rows) {
        if (r.description.toLowerCase().includes(d.distributor.toLowerCase())) flagged.add(d.distributor)
      }
    }
    return flagged
  }, [roItems, rows])

  async function createRiskFromDistributor(d) {
    await insertRow('ro_items', {
      item_type: 'risk',
      description: `${d.distributor} performance — ${fmtPct(d.pctPlan)} of target`,
      sales_channel: 'New Distribution',
      owner_name: 'Nick Kemper',
      impact_mid: -(d.target - d.actual),
      impact_low: -(d.target - d.actual) * 1.2,
      impact_high: -(d.target - d.actual) * 0.8,
      probability: 0.7,
      classification: 'base',
      status: 'open',
      next_steps: `Review performance plan with ${d.distributor}.`,
    }, profile)
  }

  return (
    <div className="space-y-4">
      {/* CONTROLS */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-600">Period</label>
          <select className="input !w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m} {FY}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <div><span className="text-slate-500">Total actual:</span> <span className="font-mono font-semibold">{fmtCompactCurrency(totals.actual)}</span></div>
            <div><span className="text-slate-500">Total target:</span> <span className="font-mono font-semibold">{fmtCompactCurrency(totals.target)}</span></div>
            <div>
              <span className="text-slate-500">Net:</span>{' '}
              <span className={classNames(
                'font-mono font-semibold',
                netVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'
              )}>
                {netVariance >= 0 ? '+' : ''}{fmtCompactCurrency(netVariance)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="!p-4">
          <div className="section-title flex items-center gap-1.5">
            <TrendingUp size={12} className="text-emerald-600" /> Overperforming
          </div>
          <div className="font-display text-2xl font-semibold mt-1 text-emerald-700">{overperformers.length}</div>
          <div className="text-xs text-slate-500">
            +{fmtCompactCurrency(overperformers.reduce((s, r) => s + (r.actual - r.target), 0))} above target
          </div>
        </Card>
        <Card className="!p-4">
          <div className="section-title">On Track (80–100%)</div>
          <div className="font-display text-2xl font-semibold mt-1 text-amber-700">{onTrack.length}</div>
        </Card>
        <Card className="!p-4">
          <div className="section-title flex items-center gap-1.5">
            <TrendingDown size={12} className="text-rose-600" /> Underperforming
          </div>
          <div className="font-display text-2xl font-semibold mt-1 text-rose-700">{underperformers.length}</div>
          <div className="text-xs text-slate-500">
            {fmtCompactCurrency(underperformers.reduce((s, r) => s + (r.actual - r.target), 0))} below target
          </div>
        </Card>
      </div>

      {/* CHART */}
      <Card title="Actual vs Target" subtitle="By distributor, 100% reference line. Red bars are under 80% of target.">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => `$${Math.round(v / 1000)}K`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="distributor"
                tick={{ fontSize: 11, fill: '#1c2d4a' }}
                tickLine={false}
                axisLine={false}
                width={140}
              />
              <Tooltip
                formatter={(v) => fmtCompactCurrency(v)}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
              <Bar dataKey="target" fill="#cbd5e1" name="Target" radius={[0, 2, 2, 0]} />
              <Bar dataKey="actual" name="Actual" radius={[0, 2, 2, 0]}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={
                    r.rag === 'green' ? '#059669' :
                    r.rag === 'amber' ? '#d97706' :
                    r.rag === 'red'   ? '#be123c' : '#94a3b8'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* TABLE */}
      <Card title="Partner-Level Detail">
        {rows.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No distributor data for this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Distributor</th>
                  <th>Region</th>
                  <th className="text-right">Target</th>
                  <th className="text-right">Actual</th>
                  <th className="text-right">Variance</th>
                  <th className="text-right">% to Plan</th>
                  <th className="text-right">Fill Rate</th>
                  <th className="text-right">Orders</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.distributor}>
                    <td className="font-medium">{r.distributor}</td>
                    <td className="text-slate-600">{r.region}</td>
                    <td className="text-right font-mono">{fmtCompactCurrency(r.target)}</td>
                    <td className="text-right font-mono">{fmtCompactCurrency(r.actual)}</td>
                    <td className={classNames(
                      'text-right font-mono',
                      r.actual - r.target >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    )}>
                      {r.actual - r.target >= 0 ? '+' : ''}{fmtCompactCurrency(r.actual - r.target)}
                    </td>
                    <td className="text-right font-mono font-semibold">{fmtPct(r.pctPlan)}</td>
                    <td className="text-right font-mono">{r.fillRate != null ? fmtPct(r.fillRate, { decimals: 0 }) : '—'}</td>
                    <td className="text-right font-mono">{r.orderFrequency ?? '—'}</td>
                    <td>
                      <Tag color={
                        r.rag === 'green' ? 'green' :
                        r.rag === 'amber' ? 'amber' :
                        r.rag === 'red'   ? 'red'   : 'slate'
                      }>
                        {r.rag === 'green' ? 'Over' : r.rag === 'amber' ? 'On track' : r.rag === 'red' ? 'Under' : '—'}
                      </Tag>
                    </td>
                    <td className="text-right">
                      {r.rag === 'red' && isManager && !flaggedInRO.has(r.distributor) && (
                        <button
                          onClick={() => createRiskFromDistributor(r)}
                          className="btn btn-ghost !text-xs text-rose-700"
                          title="Create R&O risk from this partner"
                        >
                          <Plus size={11} /> Flag
                        </button>
                      )}
                      {flaggedInRO.has(r.distributor) && (
                        <Tag color="red" className="!text-[10px]">R&O open</Tag>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-semibold bg-slate-50">
                <tr>
                  <td colSpan="2">Net</td>
                  <td className="text-right font-mono">{fmtCompactCurrency(totals.target)}</td>
                  <td className="text-right font-mono">{fmtCompactCurrency(totals.actual)}</td>
                  <td className={classNames(
                    'text-right font-mono',
                    netVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  )}>
                    {netVariance >= 0 ? '+' : ''}{fmtCompactCurrency(netVariance)}
                  </td>
                  <td className="text-right font-mono">
                    {fmtPct(totals.target ? totals.actual / totals.target : null)}
                  </td>
                  <td colSpan="4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
