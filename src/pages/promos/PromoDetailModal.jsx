/**
 * PromoDetailModal — readonly view of a promo. Triggered from the calendar
 * when a user clicks on a promo bar. Shows full SKU breakdown, trade spend
 * breakdown, and the calc rollup.
 */

import { Edit3, X as XIcon } from 'lucide-react'
import { useTable } from '../../hooks/useTable'
import { useAuth } from '../../hooks/useAuth'
import { fmtCompactCurrency, classNames } from '../../lib/format'
import { computePromoTotals } from './pricing'

export default function PromoDetailModal({ promo, onEdit, onClose }) {
  const { isManager } = useAuth()
  const { rows: skuLines }   = useTable('promo_sku_lines')
  const { rows: spendLines } = useTable('promo_trade_spend_lines')
  const { rows: skus }       = useTable('skus')
  const { rows: posMaterials } = useTable('pos_materials')

  const lines = skuLines.filter((l) => l.promo_id === promo.id)
  const spends = spendLines.filter((l) => l.promo_id === promo.id)
  const totals = computePromoTotals(promo, lines, spends)

  const skuById = new Map(skus.map((s) => [s.id, s]))
  const matById = new Map(posMaterials.map((m) => [m.id, m]))

  return (
    <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">{promo.channel}{promo.regions?.length ? ` · ${promo.regions.join(', ')}` : ''}</div>
          <h2 className="font-display text-2xl font-semibold text-navy-900">{promo.name}</h2>
          <div className="text-sm text-slate-600 mt-0.5">
            {fmtDate(promo.start_date)} – {fmtDate(promo.end_date)}
            {' · '}<span className={classNames('px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold', statusBg(promo.status))}>{promo.status}</span>
            {' · '}Owner: <span className="font-medium">{promo.owner_name || '—'}</span>
            {' · '}Tier: <span className="font-medium">{promo.customer_class}</span>
          </div>
          {promo.description && <p className="text-sm text-slate-600 mt-2 max-w-2xl">{promo.description}</p>}
          {promo.pricing_mechanics_note && <p className="text-xs text-slate-500 mt-1 italic">Mechanics: {promo.pricing_mechanics_note}</p>}
        </div>
        <div className="flex gap-2">
          {isManager && (
            <button onClick={onEdit} className="btn btn-secondary"><Edit3 size={14} /> Edit</button>
          )}
          <button onClick={onClose} className="btn btn-secondary"><XIcon size={14} /></button>
        </div>
      </div>

      {/* Top calc panel */}
      <div className="bg-navy-900 text-white rounded-lg p-4 grid grid-cols-3 md:grid-cols-6 gap-4">
        <Stat label="Total Cases" value={totals.total_cases.toLocaleString('en-US', { maximumFractionDigits: 0 })} />
        <Stat label="Gross Revenue" value={fmtCompactCurrency(totals.gross_revenue)} />
        <Stat label="Discount" value={`-${fmtCompactCurrency(totals.total_discount)}`} tone="negative" />
        <Stat label="Gross Profit" value={fmtCompactCurrency(totals.gross_profit)} />
        <Stat label="Trade Spend" value={`-${fmtCompactCurrency(totals.total_trade_spend)}`} subtitle={totals.trade_spend_pct != null ? `${(totals.trade_spend_pct * 100).toFixed(1)}% of gross` : null} tone="negative" />
        <Stat label="Contribution Profit" value={fmtCompactCurrency(totals.contribution_profit)} tone={totals.contribution_profit >= 0 ? 'positive' : 'negative'} highlight />
      </div>

      {/* SKU lines */}
      <Section title={`Cases by Product (${lines.length} lines)`}>
        {lines.length === 0 ? <Empty text="No product lines defined." /> : (
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="py-1.5 font-semibold">Product</th>
                <th className="font-semibold">Flavor</th>
                <th className="font-semibold text-right">Cases</th>
                <th className="font-semibold text-right">Price/Case</th>
                <th className="font-semibold text-right">Gross Revenue</th>
                <th className="font-semibold text-right">COGS</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const sku = l.sku_id ? skuById.get(l.sku_id) : null
                const gross = (l.cases || 0) * (l.price_per_case || 0)
                const cogs = (l.cases || 0) * (l.cogs_per_case || 0)
                return (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-1.5 font-medium">{l.product_family}</td>
                    <td className="text-slate-600">{sku?.flavor || <span className="italic text-slate-400">all flavors</span>}</td>
                    <td className="text-right font-mono">{(l.cases || 0).toLocaleString()}</td>
                    <td className="text-right font-mono">${(l.price_per_case || 0).toFixed(2)}</td>
                    <td className="text-right font-mono font-semibold">{fmtCompactCurrency(gross)}</td>
                    <td className="text-right font-mono text-slate-500">{fmtCompactCurrency(cogs)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Trade spend */}
      <Section title={`Trade Spend (${spends.length} lines)`}>
        {spends.length === 0 ? <Empty text="No trade spend lines." /> : (
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="py-1.5 font-semibold">Category</th>
                <th className="font-semibold">Description</th>
                <th className="font-semibold text-right">Detail</th>
                <th className="font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {spends.map((l) => {
                const isPOS = l.category === 'POS' && l.pos_material_id
                const mat = isPOS ? matById.get(l.pos_material_id) : null
                const total = isPOS ? (l.quantity || 0) * (l.cost_per_unit || 0) : (l.amount || 0)
                return (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-1.5 font-medium">{l.category}</td>
                    <td className="text-slate-600">{l.description || (mat?.name || '—')}</td>
                    <td className="text-right text-[10px] text-slate-500">
                      {isPOS ? `${l.quantity} × $${l.cost_per_unit}` : ''}
                    </td>
                    <td className="text-right font-mono font-semibold">{fmtCompactCurrency(total)}</td>
                  </tr>
                )
              })}
              {promo.discount_type === 'billback_per_case' && (
                <tr className="border-b border-slate-100 bg-amber-50/30">
                  <td className="py-1.5 font-medium">Billback</td>
                  <td className="text-slate-600 italic">Auto-calculated from discount config</td>
                  <td className="text-right text-[10px] text-slate-500">
                    {totals.total_cases} cases × ${promo.discount_value}/case
                  </td>
                  <td className="text-right font-mono font-semibold">{fmtCompactCurrency(totals.total_cases * (promo.discount_value || 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Section>

      {/* Notes / requirements */}
      {promo.distributor_requirements && (
        <Section title="Distributor Requirements">
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{promo.distributor_requirements}</p>
        </Section>
      )}
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y.slice(2)}`
}

function statusBg(status) {
  switch (status) {
    case 'planning':  return 'bg-slate-200 text-slate-700'
    case 'approved':  return 'bg-blue-100 text-blue-700'
    case 'active':    return 'bg-emerald-100 text-emerald-800'
    case 'completed': return 'bg-slate-100 text-slate-500'
    case 'cancelled': return 'bg-rose-100 text-rose-700'
    default: return 'bg-slate-200 text-slate-700'
  }
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <h3 className="font-display text-sm font-semibold text-navy-900 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Empty({ text }) {
  return <div className="text-xs text-slate-500 italic py-2">{text}</div>
}

function Stat({ label, value, subtitle, tone, highlight }) {
  return (
    <div className={classNames(
      'min-w-0',
      highlight && 'border-l-2 border-amber-400 pl-3'
    )}>
      <div className="text-[10px] uppercase tracking-wider text-white/60">{label}</div>
      <div className={classNames(
        'font-display font-semibold truncate',
        highlight ? 'text-xl' : 'text-base',
        tone === 'positive' && 'text-emerald-300',
        tone === 'negative' && 'text-rose-300',
      )}>{value}</div>
      {subtitle && <div className="text-[10px] text-white/50 truncate">{subtitle}</div>}
    </div>
  )
}
