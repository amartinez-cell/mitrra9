import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { Calculator, Sliders, ChevronRight, HelpCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTable, updateRow } from '../hooks/useTable'
import { Card, Tag, Modal } from '../components/ui/Primitives'
import { fmtCompactCurrency, fmtPct, classNames, monthName, MONTHS } from '../lib/format'

const FY = 2026
// Months visible in the calculator: a rolling 6-month window
const WINDOW_MONTHS = 6
const START_MONTH = 4 // April — will extend 5 more months forward

const ASSUMPTION_LABELS = {
  sku_substitution_rate:      'SKU Substitution Rate',
  substitution_recovery_rate: 'Substitution Recovery Rate',
  momentum_drag_m1:           'Momentum Drag · Month 1',
  momentum_drag_m2:           'Momentum Drag · Month 2',
  momentum_drag_m3:           'Momentum Drag · Month 3',
  cancellation_rate:          'Cancellation Rate',
  cost_of_capital_annual:     'Cost of Capital (annual)',
  affected_stores_pct:        'Affected Stores %',
  revenue_per_affected_store: 'Revenue per Affected Store',
  total_retail_doors:         'Total Retail Doors',
}

const PERCENT_KEYS = new Set([
  'sku_substitution_rate', 'substitution_recovery_rate',
  'momentum_drag_m1', 'momentum_drag_m2', 'momentum_drag_m3',
  'cancellation_rate', 'cost_of_capital_annual', 'affected_stores_pct',
])

export default function MissCalculatorPage() {
  const { profile, isManager } = useAuth()
  const { rows: assumptions } = useTable('miss_impact_assumptions')
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // User input: monthly delayed order $ amounts
  const [delays, setDelays] = useState(() => {
    const d = {}
    for (let i = 0; i < WINDOW_MONTHS; i++) {
      const m = ((START_MONTH - 1 + i) % 12) + 1
      d[m] = m === 4 ? 145000 : m === 5 ? 80000 : 0 // seed demo values
    }
    return d
  })

  // Build assumption lookup
  const A = useMemo(() => {
    const o = {}
    for (const a of assumptions) o[a.assumption_key] = Number(a.assumption_value)
    return o
  }, [assumptions])

  // Compute per-month impact
  const impactByMonth = useMemo(() => {
    const months = []
    for (let i = 0; i < WINDOW_MONTHS; i++) {
      months.push(((START_MONTH - 1 + i) % 12) + 1)
    }

    return months.map((m, idx) => {
      const delayed = Number(delays[m] || 0)

      // --- Component 1: Direct Miss -------------------------------------------
      // Portion cancelled outright (permanent loss)
      const cancelled = delayed * (A.cancellation_rate || 0)
      // The rest is delayed but eventually recovered
      const directMiss = cancelled

      // --- Component 2: SKU Substitution Multiplier --------------------------
      // Other SKUs get consumed filling the gap; some of that is later backfilled
      const substituted = delayed * (A.sku_substitution_rate || 0)
      const substitutionLoss = substituted * (1 - (A.substitution_recovery_rate || 0))

      // --- Component 3: Momentum Drag ---------------------------------------
      // Trails for 3 subsequent months. Shelf presence erosion at affected stores.
      // This month's momentum drag = sum of prior delay events that are still trailing.
      const affectedStores = (A.affected_stores_pct || 0) * (A.total_retail_doors || 0)
      const revPerStore = A.revenue_per_affected_store || 0
      const baseMonthlyStoreRev = affectedStores * revPerStore

      // For each of the last 3 months, including this one, apply the drag from its delay
      let momentumDrag = 0
      for (let lag = 1; lag <= 3; lag++) {
        const priorIdx = idx - lag
        if (priorIdx < 0) continue
        const priorDelayed = Number(delays[months[priorIdx]] || 0)
        if (priorDelayed <= 0) continue
        const dragRate = A[`momentum_drag_m${lag}`] || 0
        // Scale drag to the size of the original miss: the larger the event, the larger
        // the shelf disruption, capped by base store revenue impact.
        const missScale = Math.min(priorDelayed / Math.max(baseMonthlyStoreRev, 1), 1)
        momentumDrag += baseMonthlyStoreRev * dragRate * missScale
      }

      const trueCost = directMiss + substitutionLoss + momentumDrag
      const multiplier = delayed > 0 ? trueCost / delayed : 0

      return {
        month: m,
        monthLabel: monthName(m),
        delayed,
        directMiss,
        substitutionLoss,
        momentumDrag,
        trueCost,
        multiplier,
      }
    })
  }, [delays, A])

  const cumulative = impactByMonth.reduce((a, r) => ({
    delayed: a.delayed + r.delayed,
    directMiss: a.directMiss + r.directMiss,
    substitutionLoss: a.substitutionLoss + r.substitutionLoss,
    momentumDrag: a.momentumDrag + r.momentumDrag,
    trueCost: a.trueCost + r.trueCost,
  }), { delayed: 0, directMiss: 0, substitutionLoss: 0, momentumDrag: 0, trueCost: 0 })

  const overallMultiplier = cumulative.delayed > 0 ? cumulative.trueCost / cumulative.delayed : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-600 max-w-3xl">
          Enter monthly delayed / unshipped order amounts. The model projects true cost by combining direct loss,
          SKU substitution drain, and 90-day shelf-presence momentum drag.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(true)} className="btn btn-secondary">
            <HelpCircle size={14} /> How it works
          </button>
          {isManager && (
            <button onClick={() => setShowAssumptions(true)} className="btn btn-secondary">
              <Sliders size={14} /> Assumptions
            </button>
          )}
        </div>
      </div>

      {/* INPUTS */}
      <Card title="Monthly Delayed Orders" subtitle="Enter face-value dollar amounts by month.">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {impactByMonth.map((r) => (
            <div key={r.month}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                {monthName(r.month)}
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  className="input pl-6 font-mono text-right"
                  value={delays[r.month] || 0}
                  onChange={(e) => setDelays({ ...delays, [r.month]: Number(e.target.value) })}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="!p-4">
          <div className="section-title">Face Value · 6-mo Delay</div>
          <div className="font-display text-2xl font-semibold mt-1">{fmtCompactCurrency(cumulative.delayed)}</div>
        </Card>
        <Card className="!p-4">
          <div className="section-title">True Cost</div>
          <div className="font-display text-2xl font-semibold mt-1 text-rose-700">
            {fmtCompactCurrency(cumulative.trueCost)}
          </div>
        </Card>
        <Card className="!p-4">
          <div className="section-title">Multiplier</div>
          <div className="font-display text-2xl font-semibold mt-1">
            {overallMultiplier.toFixed(2)}×
          </div>
          <div className="text-xs text-slate-500 mt-0.5">vs face value</div>
        </Card>
        <Card className="!p-4">
          <div className="section-title">Hidden Cost</div>
          <div className="font-display text-2xl font-semibold mt-1 text-amber-700">
            {fmtCompactCurrency(cumulative.trueCost - cumulative.directMiss)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">substitution + momentum</div>
        </Card>
      </div>

      {/* CHART */}
      <Card title="Impact by Month" subtitle="Stacked components of true cost — face value shown as reference line.">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={impactByMonth}>
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
              />
              <YAxis
                tickFormatter={(v) => `$${Math.round(v / 1000)}K`}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                width={54}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                formatter={(v, name) => [fmtCompactCurrency(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="directMiss"       stackId="a" fill="#be123c" name="Direct miss (cancellations)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="substitutionLoss" stackId="a" fill="#d97706" name="Substitution loss" />
              <Bar dataKey="momentumDrag"     stackId="a" fill="#f59e0b" name="Momentum drag" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* TABLE */}
      <Card title="Month-by-Month Detail">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Delayed ($)</th>
                <th className="text-right">Direct Miss</th>
                <th className="text-right">Substitution Loss</th>
                <th className="text-right">Momentum Drag</th>
                <th className="text-right">True Cost</th>
                <th className="text-right">Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {impactByMonth.map((r) => (
                <tr key={r.month}>
                  <td className="font-medium">{monthName(r.month)}</td>
                  <td className="text-right font-mono">{fmtCompactCurrency(r.delayed)}</td>
                  <td className="text-right font-mono text-rose-700">{fmtCompactCurrency(r.directMiss)}</td>
                  <td className="text-right font-mono text-amber-700">{fmtCompactCurrency(r.substitutionLoss)}</td>
                  <td className="text-right font-mono text-amber-600">{fmtCompactCurrency(r.momentumDrag)}</td>
                  <td className="text-right font-mono font-semibold">{fmtCompactCurrency(r.trueCost)}</td>
                  <td className="text-right font-mono">
                    {r.delayed > 0 ? `${r.multiplier.toFixed(2)}×` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-semibold bg-slate-50">
              <tr>
                <td>Total</td>
                <td className="text-right font-mono">{fmtCompactCurrency(cumulative.delayed)}</td>
                <td className="text-right font-mono text-rose-700">{fmtCompactCurrency(cumulative.directMiss)}</td>
                <td className="text-right font-mono text-amber-700">{fmtCompactCurrency(cumulative.substitutionLoss)}</td>
                <td className="text-right font-mono text-amber-600">{fmtCompactCurrency(cumulative.momentumDrag)}</td>
                <td className="text-right font-mono">{fmtCompactCurrency(cumulative.trueCost)}</td>
                <td className="text-right font-mono">{overallMultiplier.toFixed(2)}×</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {showHelp && (
        <Modal open onClose={() => setShowHelp(false)} title="How the model works" maxWidth="max-w-xl">
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <div className="font-semibold text-navy-900">1 · Direct Miss</div>
              <p>A portion of delayed orders never comes back — they're cancelled outright. That share is the Cancellation Rate assumption. The rest is delayed but recoverable, and excluded from true cost.</p>
            </div>
            <div>
              <div className="font-semibold text-navy-900">2 · SKU Substitution Multiplier</div>
              <p>While the delayed SKU is unavailable, demand draws down inventory of other SKUs (the substitution rate). Over subsequent months a portion is backfilled (recovery rate). The uncovered portion is true loss.</p>
            </div>
            <div>
              <div className="font-semibold text-navy-900">3 · Momentum Drag</div>
              <p>Every stockout hurts shelf presence. Drag trails over 3 months at declining rates (M1, M2, M3). Drag is scaled to the size of the miss and capped at the base revenue of the affected stores.</p>
            </div>
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              All assumptions are configurable from the Assumptions panel (manager-only).
            </p>
          </div>
        </Modal>
      )}

      {showAssumptions && (
        <AssumptionsModal
          onClose={() => setShowAssumptions(false)}
          assumptions={assumptions}
          profile={profile}
        />
      )}
    </div>
  )
}

function AssumptionsModal({ onClose, assumptions, profile }) {
  const [local, setLocal] = useState(
    Object.fromEntries(assumptions.map((a) => [a.id, a.assumption_value]))
  )
  const [saving, setSaving] = useState(false)

  async function onSave() {
    setSaving(true)
    try {
      for (const a of assumptions) {
        if (Number(local[a.id]) !== Number(a.assumption_value)) {
          await updateRow('miss_impact_assumptions', a.id, {
            assumption_value: Number(local[a.id]),
          }, profile)
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Model assumptions" maxWidth="max-w-xl">
      <div className="space-y-3">
        {assumptions.map((a) => {
          const isPct = PERCENT_KEYS.has(a.assumption_key)
          return (
            <div key={a.id} className="grid grid-cols-[1fr_auto] gap-3 items-center">
              <div>
                <div className="text-sm font-medium">
                  {ASSUMPTION_LABELS[a.assumption_key] || a.assumption_key}
                </div>
                <div className="text-xs text-slate-500">{a.description}</div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step={isPct ? '0.01' : '1'}
                  className="input !w-24 text-right font-mono"
                  value={local[a.id]}
                  onChange={(e) => setLocal({ ...local, [a.id]: e.target.value })}
                />
                {isPct && <span className="text-xs text-slate-400">× 100 = %</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
        <button onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button onClick={onSave} disabled={saving} className="btn btn-primary">
          {saving ? 'Saving…' : 'Save assumptions'}
        </button>
      </div>
    </Modal>
  )
}
