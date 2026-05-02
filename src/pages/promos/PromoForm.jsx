/**
 * PromoForm — full entry/edit form for a promo. Used both for "+ Add Promo"
 * and "Edit" actions. Includes:
 *   - Header fields (name, dates, channel, regions, customer class, owner)
 *   - SKU lines (per-product-family, optionally per-SKU/flavor)
 *   - Trade spend lines (categorized, with POS material lookup)
 *   - Live math panel showing gross / net / GP / contribution profit
 *   - Discount controls (percent off / $ per case / billback)
 */

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, X as XIcon, Save, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTable, insertRow, updateRow } from '../../hooks/useTable'
import { mockStore } from '../../data/mockStore'
import { fmtCompactCurrency, fmtPct, classNames } from '../../lib/format'
import {
  defaultCustomerClassForChannel, lookupPricing, computePromoTotals,
  customerClassesForChannel, listProductFamilies,
} from './pricing'

const CHANNELS = ['Conventional', 'Inbound', 'New Distribution', 'Wholesale', 'Chains', 'eCommerce', 'Retail Direct']
const REGIONS = ['Florida', 'North', 'West', 'East', 'South']
const STATUSES = ['planning', 'approved', 'active', 'completed', 'cancelled']
const SPEND_CATEGORIES = ['Coolers', 'Shelf Clips', 'Displays', 'Slotting', 'Samples', 'POS', 'Billback', 'Other']

export default function PromoForm({ promo, onClose, onSaved }) {
  const { profile, isManager } = useAuth()
  const { rows: skus }          = useTable('skus')
  const { rows: pricingTiers }  = useTable('pricing_tiers')
  const { rows: posMaterials }  = useTable('pos_materials')
  const { rows: profiles }      = useTable('profiles')
  const { rows: existingLines } = useTable('promo_sku_lines')
  const { rows: existingSpend } = useTable('promo_trade_spend_lines')

  const isEdit = !!promo
  const [form, setForm] = useState(() => ({
    name: promo?.name || '',
    description: promo?.description || '',
    start_date: promo?.start_date || todayISO(),
    end_date: promo?.end_date || addDaysISO(7),
    channel: promo?.channel || 'Conventional',
    customer_class: promo?.customer_class || 'Distributor',
    regions: promo?.regions || [],
    discount_type: promo?.discount_type || 'none',
    discount_value: promo?.discount_value || 0,
    status: promo?.status || 'planning',
    owner_id: promo?.owner_id || profile.id,
    pricing_mechanics_note: promo?.pricing_mechanics_note || '',
    distributor_requirements: promo?.distributor_requirements || '',
  }))

  // Local working copies of line items so edits aren't persisted until Save
  const [skuLines, setSkuLines] = useState(() =>
    isEdit
      ? existingLines.filter((l) => l.promo_id === promo.id).map((l) => ({ ...l, _existing: true }))
      : []
  )
  const [spendLines, setSpendLines] = useState(() =>
    isEdit
      ? existingSpend.filter((l) => l.promo_id === promo.id).map((l) => ({ ...l, _existing: true }))
      : []
  )

  // When channel changes, default the customer_class
  function onChannelChange(channel) {
    setForm((f) => ({ ...f, channel, customer_class: defaultCustomerClassForChannel(channel) }))
  }

  // Available customer classes for this channel (filters the pricing-tier set)
  const availableCustomerClasses = useMemo(() => {
    const list = customerClassesForChannel(form.channel, pricingTiers)
    if (list.length === 0) return ['Distributor']
    return list
  }, [form.channel, pricingTiers])

  // Auto-set customer_class if current selection isn't valid for the new channel
  useEffect(() => {
    if (!availableCustomerClasses.includes(form.customer_class)) {
      setForm((f) => ({ ...f, customer_class: availableCustomerClasses[0] }))
    }
  }, [availableCustomerClasses])

  // Re-price every SKU line whenever customer_class changes
  useEffect(() => {
    setSkuLines((prev) => prev.map((line) => repriceLine(line, form.customer_class, pricingTiers)))
  }, [form.customer_class, pricingTiers])

  // Live totals
  const totals = useMemo(
    () => computePromoTotals(form, skuLines, spendLines),
    [form, skuLines, spendLines]
  )

  function addSkuLine() {
    const productFamilies = listProductFamilies(pricingTiers)
    const fam = productFamilies[0]
    const newLine = repriceLine({
      _temp_id: `tmp-${Date.now()}`,
      product_family: fam,
      sku_id: null,
      cases: 1,
    }, form.customer_class, pricingTiers)
    setSkuLines((prev) => [...prev, newLine])
  }

  function updateSkuLine(idx, patch) {
    setSkuLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l
      const merged = { ...l, ...patch }
      // If product_family or cases changed, re-look-up pricing
      if (patch.product_family !== undefined || patch.cases !== undefined) {
        return repriceLine(merged, form.customer_class, pricingTiers)
      }
      return merged
    }))
  }

  function removeSkuLine(idx) {
    setSkuLines((prev) => prev.filter((_, i) => i !== idx))
  }

  function addSpendLine() {
    setSpendLines((prev) => [...prev, {
      _temp_id: `tmp-${Date.now()}`,
      category: 'Other',
      description: '',
      pos_material_id: null,
      quantity: null,
      cost_per_unit: null,
      amount: 0,
    }])
  }

  function updateSpendLine(idx, patch) {
    setSpendLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l
      const merged = { ...l, ...patch }
      // If a POS material was selected, fill in cost from the catalog
      if (patch.pos_material_id !== undefined && patch.pos_material_id) {
        const mat = posMaterials.find((m) => m.id === patch.pos_material_id)
        if (mat) {
          merged.description = mat.name
          merged.cost_per_unit = mat.cost_per_unit
          merged.category = 'POS'
          if (!merged.quantity) merged.quantity = 1
        }
      }
      return merged
    }))
  }

  function removeSpendLine(idx) {
    setSpendLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Name is required.'); return }
    if (!form.start_date || !form.end_date) { alert('Start and end dates are required.'); return }
    if (form.end_date < form.start_date) { alert('End date must be after start date.'); return }

    const owner = profiles.find((p) => p.id === form.owner_id)
    const promoFields = {
      ...form,
      owner_name: owner?.full_name || null,
      ...totals,  // denormalized rollups
    }

    let saved
    if (isEdit) {
      saved = await updateRow('promos_v2', promo.id, promoFields, profile)
      // Replace lines: simplest approach — delete all existing and re-insert
      const oldSkuIds = existingLines.filter((l) => l.promo_id === promo.id).map((l) => l.id)
      const oldSpendIds = existingSpend.filter((l) => l.promo_id === promo.id).map((l) => l.id)
      for (const id of oldSkuIds) mockStore.remove('promo_sku_lines', id)
      for (const id of oldSpendIds) mockStore.remove('promo_trade_spend_lines', id)
    } else {
      saved = await insertRow('promos_v2', { ...promoFields, created_by: profile.id }, profile)
    }
    // Insert lines
    for (const [i, line] of skuLines.entries()) {
      const { _temp_id, _existing, id, gross_revenue, total_cogs, ...rest } = line
      await insertRow('promo_sku_lines', {
        ...rest,
        promo_id: saved.id,
        sort_order: i,
      }, profile)
    }
    for (const [i, line] of spendLines.entries()) {
      const { _temp_id, _existing, id, ...rest } = line
      await insertRow('promo_trade_spend_lines', {
        ...rest,
        promo_id: saved.id,
        sort_order: i,
      }, profile)
    }

    onSaved?.(saved)
    onClose?.()
  }

  return (
    <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
      {/* Header — name + dates + channel */}
      <Section title="Promo Basics">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Promo Name" wide>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 4th of July National Promo" />
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <select className="input" value={form.owner_id || ''} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
              {profiles.filter((p) => ['manager','director','rep'].includes(p.role)).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Start Date">
            <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="End Date">
            <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
          <Field label="Channel">
            <select className="input" value={form.channel} onChange={(e) => onChannelChange(e.target.value)}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Customer Class (Pricing Tier)">
            <select className="input" value={form.customer_class} onChange={(e) => setForm({ ...form, customer_class: e.target.value })}>
              {availableCustomerClasses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {form.channel === 'Conventional' && (
            <Field label="Regions" wide>
              <RegionMultiSelect
                value={form.regions}
                onChange={(regions) => setForm({ ...form, regions })}
              />
            </Field>
          )}
          <Field label="Description" wide>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Pricing Mechanics Note" wide>
            <input className="input" value={form.pricing_mechanics_note} onChange={(e) => setForm({ ...form, pricing_mechanics_note: e.target.value })} placeholder='e.g. "2 for $10 SRP", "BOGO at Sprouts"' />
          </Field>
        </div>
      </Section>

      {/* Discount */}
      <Section title="Discount Structure">
        <div className="grid grid-cols-3 gap-3 items-end">
          <Field label="Discount Type">
            <select className="input" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
              <option value="none">None</option>
              <option value="percent_off">% Off Price</option>
              <option value="dollar_off_per_case">$ Off Per Case</option>
              <option value="billback_per_case">Billback (Per Case)</option>
            </select>
          </Field>
          {form.discount_type !== 'none' && (
            <Field label={form.discount_type === 'percent_off' ? 'Percent Off (e.g. 0.10 for 10%)' : '$ Per Case'}>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })}
              />
            </Field>
          )}
          {form.discount_type === 'billback_per_case' && (
            <div className="text-xs text-slate-600 pb-2">
              Billback is treated as <strong>trade spend</strong>, so it reduces contribution profit but not gross revenue.
            </div>
          )}
        </div>
      </Section>

      {/* SKU Lines */}
      <Section
        title="Cases by Product"
        action={<button onClick={addSkuLine} className="btn btn-secondary text-xs"><Plus size={12} /> Add Line</button>}
      >
        {skuLines.length === 0 ? (
          <EmptyHint text='No product lines yet. Click "Add Line" to add product families and case counts.' />
        ) : (
          <div className="space-y-2">
            {skuLines.map((line, idx) => (
              <SkuLineRow
                key={line._temp_id || line.id || idx}
                line={line}
                skus={skus}
                pricingTiers={pricingTiers}
                customerClass={form.customer_class}
                onChange={(patch) => updateSkuLine(idx, patch)}
                onRemove={() => removeSkuLine(idx)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Trade Spend Lines */}
      <Section
        title="Trade Spend"
        action={<button onClick={addSpendLine} className="btn btn-secondary text-xs"><Plus size={12} /> Add Spend</button>}
      >
        {spendLines.length === 0 ? (
          <EmptyHint text='No trade spend lines yet. Add coolers, displays, samples, POS materials, etc.' />
        ) : (
          <div className="space-y-2">
            {spendLines.map((line, idx) => (
              <SpendLineRow
                key={line._temp_id || line.id || idx}
                line={line}
                posMaterials={posMaterials}
                onChange={(patch) => updateSpendLine(idx, patch)}
                onRemove={() => removeSpendLine(idx)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Live calc panel */}
      <div className="bg-navy-900 text-white rounded-lg p-4 grid grid-cols-3 md:grid-cols-6 gap-4">
        <Stat label="Total Cases" value={totals.total_cases.toLocaleString('en-US', { maximumFractionDigits: 0 })} />
        <Stat label="Gross Revenue" value={fmtCompactCurrency(totals.gross_revenue)} />
        <Stat label="Discount" value={`-${fmtCompactCurrency(totals.total_discount)}`} tone="negative" />
        <Stat label="Gross Profit" value={fmtCompactCurrency(totals.gross_profit)} />
        <Stat label="Trade Spend" value={`-${fmtCompactCurrency(totals.total_trade_spend)}`} subtitle={totals.trade_spend_pct != null ? `${(totals.trade_spend_pct * 100).toFixed(1)}% of gross` : null} tone="negative" />
        <Stat
          label="Contribution Profit"
          value={fmtCompactCurrency(totals.contribution_profit)}
          tone={totals.contribution_profit >= 0 ? 'positive' : 'negative'}
          highlight
        />
      </div>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-100">
        <button onClick={onClose} className="btn btn-secondary"><XIcon size={14} /> Cancel</button>
        <button onClick={handleSave} className="btn btn-primary"><Save size={14} /> {isEdit ? 'Save Changes' : 'Create Promo'}</button>
      </div>
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function repriceLine(line, customerClass, pricingTiers) {
  const tier = lookupPricing(pricingTiers, {
    product_family: line.product_family,
    customer_class: customerClass,
    cases: line.cases || 1,
  })
  if (!tier) {
    return {
      ...line,
      pricing_tier_id: null,
      price_per_case: 0,
      cogs_per_case: 0,
      _tierLabel: 'No matching tier',
    }
  }
  return {
    ...line,
    pricing_tier_id: tier.id,
    price_per_case: tier.price_per_case,
    cogs_per_case: tier.cogs_per_case || 0,
    _tierLabel: `${tier.customer_class} · ${tier.order_min}${tier.order_max ? '-' + tier.order_max : '+'} cases · $${tier.price_per_case}/case`,
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function addDaysISO(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// =============================================================================
// Sub-components
// =============================================================================

function Section({ title, action, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-sm font-semibold text-navy-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children, wide }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function EmptyHint({ text }) {
  return <div className="text-xs text-slate-500 italic py-2">{text}</div>
}

function RegionMultiSelect({ value, onChange }) {
  function toggle(r) {
    const set = new Set(value)
    if (set.has(r)) set.delete(r)
    else set.add(r)
    onChange([...set])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {REGIONS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => toggle(r)}
          className={classNames(
            'px-2 py-1 text-xs rounded border',
            value.includes(r)
              ? 'bg-navy-900 text-white border-navy-900'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

function SkuLineRow({ line, skus, pricingTiers, customerClass, onChange, onRemove }) {
  const productFamilies = listProductFamilies(pricingTiers)
  const flavorsForFamily = skus.filter((s) => s.product_family === line.product_family && s.active)
  const lineTotal = (Number(line.cases) || 0) * (Number(line.price_per_case) || 0)
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-2 grid grid-cols-12 gap-2 items-center">
      <div className="col-span-3">
        <select
          className="input !text-xs !py-1"
          value={line.product_family}
          onChange={(e) => onChange({ product_family: e.target.value, sku_id: null })}
        >
          {productFamilies.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="col-span-3">
        <select
          className="input !text-xs !py-1"
          value={line.sku_id || ''}
          onChange={(e) => onChange({ sku_id: e.target.value || null })}
        >
          <option value="">— Family-level (any flavor) —</option>
          {flavorsForFamily.map((s) => <option key={s.id} value={s.id}>{s.flavor}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <input
          type="number"
          step="1"
          className="input !text-xs !py-1 text-right"
          value={line.cases}
          onChange={(e) => onChange({ cases: parseFloat(e.target.value) || 0 })}
          placeholder="Cases"
        />
      </div>
      <div className="col-span-3 text-right text-xs">
        <div className="font-mono font-semibold">{fmtCompactCurrency(lineTotal)}</div>
        <div className="text-[10px] text-slate-500 truncate" title={line._tierLabel}>{line._tierLabel || `$${line.price_per_case || 0}/case`}</div>
      </div>
      <div className="col-span-1 text-right">
        <button onClick={onRemove} className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function SpendLineRow({ line, posMaterials, onChange, onRemove }) {
  const isPOS = line.category === 'POS'
  const calcTotal = isPOS && line.quantity != null && line.cost_per_unit != null
    ? Number(line.quantity) * Number(line.cost_per_unit)
    : Number(line.amount) || 0

  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-2 grid grid-cols-12 gap-2 items-center">
      <div className="col-span-2">
        <select
          className="input !text-xs !py-1"
          value={line.category}
          onChange={(e) => {
            const cat = e.target.value
            // Reset POS-specific fields when leaving POS
            if (cat !== 'POS') {
              onChange({ category: cat, pos_material_id: null, quantity: null, cost_per_unit: null })
            } else {
              onChange({ category: cat })
            }
          }}
        >
          {SPEND_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {isPOS ? (
        <>
          <div className="col-span-4">
            <select
              className="input !text-xs !py-1"
              value={line.pos_material_id || ''}
              onChange={(e) => onChange({ pos_material_id: e.target.value || null })}
            >
              <option value="">— Pick a POS item —</option>
              {posMaterials.filter((m) => m.active !== false).map((m) => (
                <option key={m.id} value={m.id}>{m.name} (${m.cost_per_unit}/{m.unit_label})</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <input
              type="number"
              step="1"
              className="input !text-xs !py-1 text-right"
              placeholder="Qty"
              value={line.quantity || ''}
              onChange={(e) => onChange({ quantity: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="col-span-2 text-xs text-slate-500 text-right pr-2">
            × ${line.cost_per_unit || 0}
          </div>
        </>
      ) : (
        <>
          <div className="col-span-6">
            <input
              className="input !text-xs !py-1"
              placeholder="Description"
              value={line.description}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <input
              type="number"
              step="0.01"
              className="input !text-xs !py-1 text-right"
              placeholder="$ Amount"
              value={line.amount}
              onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </>
      )}
      <div className="col-span-1 text-right text-xs font-mono font-semibold">
        {fmtCompactCurrency(calcTotal)}
      </div>
      <div className="col-span-1 text-right">
        <button onClick={onRemove} className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
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
