/**
 * PricingAdminPage — manager/director-only page to adjust COGS values on the
 * canonical pricing tiers. Promos that have already been saved keep their
 * snapshotted COGS (since promo_sku_lines stores it at line level), so editing
 * COGS here only affects future promos.
 */

import { useMemo, useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTable, updateRow } from '../../hooks/useTable'
import { fmtCompactCurrency, classNames } from '../../lib/format'

export default function PricingAdminPage() {
  const { profile, isManager } = useAuth()
  const { rows: tiers } = useTable('pricing_tiers')
  const [edits, setEdits] = useState({})  // tierId → { cogs_per_unit, cogs_per_case }

  if (!isManager) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-card p-8 text-center">
        <p className="text-slate-700 font-semibold">Manager / Director access required</p>
      </div>
    )
  }

  // Group tiers by product family for readable layout
  const grouped = useMemo(() => {
    const m = {}
    for (const t of tiers) {
      if (!m[t.product_family]) m[t.product_family] = []
      m[t.product_family].push(t)
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => {
        if (a.customer_class !== b.customer_class) return a.customer_class.localeCompare(b.customer_class)
        return (a.order_min || 0) - (b.order_min || 0)
      })
    }
    return m
  }, [tiers])

  function getEffective(tier) {
    return edits[tier.id] || { cogs_per_unit: tier.cogs_per_unit, cogs_per_case: tier.cogs_per_case }
  }

  function setEdit(tier, field, value) {
    const v = value === '' ? null : parseFloat(value)
    setEdits((e) => ({ ...e, [tier.id]: { ...getEffective(tier), [field]: v } }))
  }

  // Auto-recompute cogs_per_case from cogs_per_unit if user only changes the unit cost
  function setUnitCogs(tier, value) {
    const v = value === '' ? null : parseFloat(value)
    const newCase = v != null && tier.units_per_case ? Math.round(v * tier.units_per_case * 100) / 100 : null
    setEdits((e) => ({ ...e, [tier.id]: { cogs_per_unit: v, cogs_per_case: newCase } }))
  }

  async function handleSave() {
    const ids = Object.keys(edits)
    if (ids.length === 0) return
    if (!confirm(`Save COGS changes to ${ids.length} tier${ids.length === 1 ? '' : 's'}? Future promos will use these values.`)) return
    for (const id of ids) {
      const patch = edits[id]
      await updateRow('pricing_tiers', id, patch, profile)
    }
    setEdits({})
  }

  function handleDiscard() {
    if (Object.keys(edits).length === 0) return
    if (!confirm('Discard all unsaved COGS changes?')) return
    setEdits({})
  }

  const pendingCount = Object.keys(edits).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600 max-w-2xl">
          Edit COGS per unit / per case for each pricing tier. Changes apply to <strong>future</strong> promos only — existing promos keep the COGS values snapshotted at the time they were created.
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs text-slate-500">{pendingCount} pending change{pendingCount === 1 ? '' : 's'}</span>
          )}
          <button onClick={handleDiscard} disabled={pendingCount === 0} className={classNames('btn btn-secondary', pendingCount === 0 && 'opacity-60 cursor-not-allowed')}>
            <RotateCcw size={14} /> Discard
          </button>
          <button onClick={handleSave} disabled={pendingCount === 0} className={classNames('btn', pendingCount > 0 ? 'btn-primary' : 'btn-secondary opacity-60 cursor-not-allowed')}>
            <Save size={14} /> Save {pendingCount > 0 ? `(${pendingCount})` : ''}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {Object.keys(grouped).sort().map((family) => (
          <div key={family} className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
              <h3 className="font-display font-semibold text-navy-900">{family}</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wider">Customer Class</th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wider">Order Size</th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wider text-right">Price/Case</th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wider text-right">Units/Case</th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wider text-right">COGS/Unit</th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wider text-right">COGS/Case</th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wider text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {grouped[family].map((tier) => {
                  const eff = getEffective(tier)
                  const hasEdit = !!edits[tier.id]
                  const margin = (eff.cogs_per_case != null && tier.price_per_case)
                    ? (tier.price_per_case - eff.cogs_per_case) / tier.price_per_case
                    : null
                  return (
                    <tr key={tier.id} className={classNames('border-t border-slate-100', hasEdit && 'bg-amber-50/40')}>
                      <td className="px-4 py-2 font-medium">{tier.customer_class}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">
                        {tier.order_min}{tier.order_max ? `–${tier.order_max}` : '+'} cases
                      </td>
                      <td className="text-right px-4 py-2 font-mono">${tier.price_per_case}</td>
                      <td className="text-right px-4 py-2 font-mono text-slate-500">{tier.units_per_case || '—'}</td>
                      <td className="text-right px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          className="input !text-xs !py-1 text-right w-24 !inline-block"
                          value={eff.cogs_per_unit ?? ''}
                          onChange={(e) => setUnitCogs(tier, e.target.value)}
                          placeholder="—"
                        />
                      </td>
                      <td className="text-right px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          className="input !text-xs !py-1 text-right w-24 !inline-block"
                          value={eff.cogs_per_case ?? ''}
                          onChange={(e) => setEdit(tier, 'cogs_per_case', e.target.value)}
                          placeholder="—"
                        />
                      </td>
                      <td className={classNames(
                        'text-right px-4 py-2 font-mono text-xs',
                        margin == null ? 'text-slate-400' :
                        margin >= 0.4 ? 'text-emerald-700' :
                        margin >= 0.2 ? 'text-amber-700' :
                        'text-rose-700'
                      )}>
                        {margin == null ? '—' : `${(margin * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
