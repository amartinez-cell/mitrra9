import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import {
  Plus, Send, Trash2, Edit3, Check, X as XIcon, ChevronRight, ChevronDown,
  FileText, GitBranch, BarChart3, Grid3x3,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTable, insertRow, updateRow, deleteRow } from '../hooks/useTable'
import { useAsync } from '../hooks/useAsync'
import { fetchByChannel } from '../lib/bigqueryApi'
import { Card, Tag, Modal, EmptyState } from '../components/ui/Primitives'
import {
  fmtCompactCurrency, fmtPct, fmtNumber, classNames, monthName, MONTHS,
} from '../lib/format'
import ForecastGrid from './forecast-grid/ForecastGrid'

const FY = 2026
const DEFAULT_MONTH = 4
const CHANNELS = ['Conventional', 'New Distribution', 'Wholesale', 'Chains', 'Inbound', 'B2C']
const PRODUCT_CATEGORIES = ['Shots', 'Seltzers', 'Sticks', 'Kegs']

export default function PlanForecastPage() {
  const { profile, isManager, isRep, canWrite } = useAuth()
  const [tab, setTab] = useState('grid')
  const [month, setMonth] = useState(DEFAULT_MONTH)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
          <TabButton active={tab === 'grid'}      onClick={() => setTab('grid')}      icon={Grid3x3}>Reforecast Grid</TabButton>
          <TabButton active={tab === 'variance'}  onClick={() => setTab('variance')}  icon={BarChart3}>Channel Variance</TabButton>
          <TabButton active={tab === 'bridge'}    onClick={() => setTab('bridge')}    icon={GitBranch}>Plan-to-Actuals Bridge</TabButton>
          <TabButton active={tab === 'forecast'}  onClick={() => setTab('forecast')}  icon={FileText}>Legacy Entry</TabButton>
        </div>
        {tab !== 'grid' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">Period</label>
            <select className="input !w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m} {FY}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {tab === 'grid'     && <ForecastGrid fiscalYear={FY} />}
      {tab === 'forecast' && <ForecastEntryTab month={month} profile={profile} isManager={isManager} isRep={isRep} canWrite={canWrite} />}
      {tab === 'variance' && <VarianceTab     month={month} />}
      {tab === 'bridge'   && <BridgeTab       month={month} isManager={isManager} profile={profile} />}
    </div>
  )
}

function TabButton({ active, onClick, children, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        active ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      )}
    >
      <Icon size={14} />
      {children}
    </button>
  )
}

// =============================================================================
// FORECAST ENTRY TAB
// =============================================================================
function ForecastEntryTab({ month, profile, isManager, isRep, canWrite }) {
  const { rows: forecasts } = useTable('forecast_entries')
  const { rows: profiles }  = useTable('profiles')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // Rep only sees their own rows; managers see all
  const visible = useMemo(() => {
    return forecasts
      .filter((f) => f.fiscal_year === FY && f.month === month)
      .filter((f) => isManager || f.submitted_by === profile.id)
      .sort((a, b) => a.sales_channel.localeCompare(b.sales_channel) || a.customer_name.localeCompare(b.customer_name))
  }, [forecasts, month, isManager, profile])

  const totalForecast = visible.reduce((s, f) => s + Number(f.forecasted_revenue || 0), 0)
  const submittedCount = visible.filter((f) => f.status !== 'draft').length
  const draftCount = visible.filter((f) => f.status === 'draft').length

  // By channel summary
  const byChannel = useMemo(() => {
    const m = {}
    for (const f of visible) {
      if (!m[f.sales_channel]) m[f.sales_channel] = { revenue: 0, count: 0 }
      m[f.sales_channel].revenue += Number(f.forecasted_revenue || 0)
      m[f.sales_channel].count += 1
    }
    return Object.entries(m).sort((a, b) => b[1].revenue - a[1].revenue)
  }, [visible])

  async function handleSubmit(row) {
    await updateRow('forecast_entries', row.id, {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }, profile)
  }

  async function handleApprove(row) {
    await updateRow('forecast_entries', row.id, {
      status: 'approved',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    }, profile)
  }

  async function handleRequestRevision(row) {
    await updateRow('forecast_entries', row.id, { status: 'revised' }, profile)
  }

  async function handleDelete(row) {
    if (!confirm('Delete this forecast entry?')) return
    await deleteRow('forecast_entries', row.id, profile)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="!p-4">
          <div className="section-title">Total Forecast</div>
          <div className="font-display text-2xl font-semibold mt-1">{fmtCompactCurrency(totalForecast)}</div>
          <div className="text-xs text-slate-500 mt-0.5">{visible.length} line items</div>
        </Card>
        <Card className="!p-4">
          <div className="section-title">Submitted</div>
          <div className="font-display text-2xl font-semibold mt-1 text-emerald-700">{submittedCount}</div>
        </Card>
        <Card className="!p-4">
          <div className="section-title">Draft</div>
          <div className="font-display text-2xl font-semibold mt-1 text-amber-700">{draftCount}</div>
        </Card>
        <Card className="!p-4">
          <div className="section-title">Period</div>
          <div className="font-display text-2xl font-semibold mt-1">{monthName(month)} {FY}</div>
        </Card>
      </div>

      <Card
        title={isRep ? 'My Forecast' : 'Team Forecast'}
        subtitle="Partner + product category granularity. Reps edit drafts; managers approve submissions."
        right={
          canWrite && (
            <button onClick={() => setShowAdd(true)} className="btn btn-primary">
              <Plus size={14} /> Add entry
            </button>
          )
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No forecast entries yet"
            description={`Add a partner-level forecast for ${monthName(month)} to get started.`}
            action={
              canWrite && (
                <button onClick={() => setShowAdd(true)} className="btn btn-primary">
                  <Plus size={14} /> Add entry
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  {isManager && <th>Rep</th>}
                  <th>Channel</th>
                  <th>Customer</th>
                  <th>Category</th>
                  <th>SKU</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Units</th>
                  <th>Conf.</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((f) => {
                  const rep = profiles.find((p) => p.id === f.submitted_by)
                  return editingId === f.id ? (
                    <EditingRow
                      key={f.id}
                      entry={f}
                      isManager={isManager}
                      rep={rep}
                      onCancel={() => setEditingId(null)}
                      onSaved={() => setEditingId(null)}
                      profile={profile}
                    />
                  ) : (
                    <tr key={f.id}>
                      {isManager && <td className="text-xs text-slate-600">{rep?.full_name || '—'}</td>}
                      <td>{f.sales_channel}</td>
                      <td className="font-medium">{f.customer_name}</td>
                      <td>{f.product_category || '—'}</td>
                      <td className="font-mono text-xs">{f.sku || '—'}</td>
                      <td className="text-right font-mono">{fmtCompactCurrency(f.forecasted_revenue)}</td>
                      <td className="text-right font-mono">{fmtNumber(f.forecasted_units)}</td>
                      <td>
                        <Tag color={
                          f.confidence === 'high'   ? 'green' :
                          f.confidence === 'medium' ? 'amber' : 'red'
                        }>
                          {f.confidence || '—'}
                        </Tag>
                      </td>
                      <td>
                        <Tag color={statusColor(f.status)}>{f.status}</Tag>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {f.status === 'draft' && f.submitted_by === profile.id && (
                            <button onClick={() => handleSubmit(f)} className="btn btn-ghost !px-2" title="Submit">
                              <Send size={13} />
                            </button>
                          )}
                          {isManager && f.status === 'submitted' && (
                            <>
                              <button onClick={() => handleApprove(f)} className="btn btn-ghost !px-2 text-emerald-700" title="Approve">
                                <Check size={14} />
                              </button>
                              <button onClick={() => handleRequestRevision(f)} className="btn btn-ghost !px-2 text-amber-700" title="Request revision">
                                <XIcon size={14} />
                              </button>
                            </>
                          )}
                          {(f.submitted_by === profile.id && f.status === 'draft') || isManager ? (
                            <>
                              <button onClick={() => setEditingId(f.id)} className="btn btn-ghost !px-2" title="Edit">
                                <Edit3 size={13} />
                              </button>
                              {f.status === 'draft' && f.submitted_by === profile.id && (
                                <button onClick={() => handleDelete(f)} className="btn btn-ghost !px-2 text-rose-600" title="Delete">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold bg-slate-50">
                  <td colSpan={isManager ? 5 : 4} className="text-right">Total</td>
                  <td className="text-right font-mono">{fmtCompactCurrency(totalForecast)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* By-channel summary */}
      {visible.length > 0 && (
        <Card title="Rollup by Channel">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {byChannel.map(([ch, info]) => (
              <div key={ch} className="bg-slate-50 rounded-md p-3">
                <div className="text-xs text-slate-500">{ch}</div>
                <div className="font-display text-lg font-semibold mt-0.5">
                  {fmtCompactCurrency(info.revenue)}
                </div>
                <div className="text-xs text-slate-500">{info.count} line{info.count === 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showAdd && (
        <AddForecastModal
          month={month}
          onClose={() => setShowAdd(false)}
          profile={profile}
          isManager={isManager}
        />
      )}
    </div>
  )
}

function AddForecastModal({ month, onClose, profile, isManager }) {
  const [form, setForm] = useState({
    customer_name: '',
    sales_channel: profile.sales_channel || 'Conventional',
    product_category: 'Shots',
    sku: '',
    forecasted_revenue: '',
    forecasted_units: '',
    confidence: 'medium',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function onSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await insertRow('forecast_entries', {
        fiscal_year: FY,
        month,
        submitted_by: profile.id,
        sales_channel: form.sales_channel,
        customer_name: form.customer_name,
        product_category: form.product_category,
        sku: form.sku || null,
        forecasted_revenue: Number(form.forecasted_revenue),
        forecasted_units: form.forecasted_units ? Number(form.forecasted_units) : null,
        confidence: form.confidence,
        notes: form.notes || null,
        status: 'draft',
      }, profile)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Add forecast — ${monthName(month)} ${FY}`}>
      <form onSubmit={onSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Channel">
            <select
              className="input"
              value={form.sales_channel}
              onChange={(e) => setForm({ ...form, sales_channel: e.target.value })}
              disabled={!isManager && profile.sales_channel}
            >
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Customer / Partner">
            <input
              className="input"
              required
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            />
          </Field>
          <Field label="Product Category">
            <select
              className="input"
              value={form.product_category}
              onChange={(e) => setForm({ ...form, product_category: e.target.value })}
            >
              {PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="SKU (optional)">
            <input
              className="input"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </Field>
          <Field label="Forecasted Revenue ($)">
            <input
              className="input"
              type="number"
              required
              min="0"
              value={form.forecasted_revenue}
              onChange={(e) => setForm({ ...form, forecasted_revenue: e.target.value })}
            />
          </Field>
          <Field label="Forecasted Units (optional)">
            <input
              className="input"
              type="number"
              min="0"
              value={form.forecasted_units}
              onChange={(e) => setForm({ ...form, forecasted_units: e.target.value })}
            />
          </Field>
          <Field label="Confidence">
            <select
              className="input"
              value={form.confidence}
              onChange={(e) => setForm({ ...form, confidence: e.target.value })}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            className="input"
            rows="2"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save as draft'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditingRow({ entry, isManager, rep, onCancel, onSaved, profile }) {
  const [form, setForm] = useState({
    customer_name: entry.customer_name,
    sales_channel: entry.sales_channel,
    product_category: entry.product_category || '',
    sku: entry.sku || '',
    forecasted_revenue: entry.forecasted_revenue,
    forecasted_units: entry.forecasted_units || '',
    confidence: entry.confidence || 'medium',
    notes: entry.notes || '',
  })
  async function save() {
    await updateRow('forecast_entries', entry.id, {
      customer_name: form.customer_name,
      sales_channel: form.sales_channel,
      product_category: form.product_category || null,
      sku: form.sku || null,
      forecasted_revenue: Number(form.forecasted_revenue),
      forecasted_units: form.forecasted_units ? Number(form.forecasted_units) : null,
      confidence: form.confidence,
      notes: form.notes || null,
    }, profile)
    onSaved()
  }
  return (
    <tr className="bg-amber-50/60">
      {isManager && <td className="text-xs text-slate-600">{rep?.full_name || '—'}</td>}
      <td>
        <select className="input !py-1" value={form.sales_channel} onChange={(e) => setForm({ ...form, sales_channel: e.target.value })}>
          {CHANNELS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </td>
      <td><input className="input !py-1" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></td>
      <td>
        <select className="input !py-1" value={form.product_category} onChange={(e) => setForm({ ...form, product_category: e.target.value })}>
          <option value="">—</option>
          {PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </td>
      <td><input className="input !py-1 font-mono text-xs" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></td>
      <td><input type="number" className="input !py-1 text-right font-mono" value={form.forecasted_revenue} onChange={(e) => setForm({ ...form, forecasted_revenue: e.target.value })} /></td>
      <td><input type="number" className="input !py-1 text-right font-mono" value={form.forecasted_units} onChange={(e) => setForm({ ...form, forecasted_units: e.target.value })} /></td>
      <td>
        <select className="input !py-1" value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </td>
      <td><Tag color={statusColor(entry.status)}>{entry.status}</Tag></td>
      <td className="text-right whitespace-nowrap">
        <button onClick={save} className="btn btn-primary !py-1 !px-2"><Check size={13} /></button>
        <button onClick={onCancel} className="btn btn-ghost !py-1 !px-2 ml-1"><XIcon size={13} /></button>
      </td>
    </tr>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  )
}

function statusColor(s) {
  return { draft: 'amber', submitted: 'blue', approved: 'green', revised: 'red' }[s] || 'slate'
}

// =============================================================================
// VARIANCE TAB (Plan vs Re-Forecast vs Actuals)
// =============================================================================
function VarianceTab({ month }) {
  const { rows: plan }      = useTable('annual_plan')
  const { rows: forecasts } = useTable('forecast_entries')
  const { data: actuals }   = useAsync(() => fetchByChannel(FY, month), [month])

  const rows = useMemo(() => {
    const planByCh = {}
    const fcByCh = {}
    plan.filter((p) => p.fiscal_year === FY && p.month === month)
      .forEach((p) => { planByCh[p.sales_channel] = Number(p.planned_revenue) })
    forecasts.filter((f) => f.fiscal_year === FY && f.month === month && ['submitted', 'approved'].includes(f.status))
      .forEach((f) => { fcByCh[f.sales_channel] = (fcByCh[f.sales_channel] || 0) + Number(f.forecasted_revenue) })
    const actualByCh = {}
    for (const r of actuals?.rows || []) actualByCh[r.sales_channel] = r.revenue

    const channels = Array.from(new Set([...Object.keys(planByCh), ...Object.keys(fcByCh), ...Object.keys(actualByCh)]))
    return channels.map((ch) => {
      const planV = planByCh[ch] || 0
      const fcV   = fcByCh[ch]   || 0
      const acV   = actualByCh[ch] || 0
      return {
        channel: ch,
        plan: planV,
        reforecast: fcV,
        actual: acV,
        varPlanReforecast: fcV - planV,
        varPlanActual: acV - planV,
        pctActualPlan: planV ? acV / planV : null,
      }
    }).sort((a, b) => b.plan - a.plan)
  }, [plan, forecasts, actuals, month])

  const totals = rows.reduce((acc, r) => ({
    plan: acc.plan + r.plan,
    reforecast: acc.reforecast + r.reforecast,
    actual: acc.actual + r.actual,
  }), { plan: 0, reforecast: 0, actual: 0 })

  const totalVarPlanRf = totals.reforecast - totals.plan
  const totalVarPlanAc = totals.actual - totals.plan

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <SmallStat label="Plan" value={fmtCompactCurrency(totals.plan)} />
        <SmallStat label="Bottom-up Forecast" value={fmtCompactCurrency(totals.reforecast)} />
        <SmallStat
          label="Actual (MTD)"
          value={fmtCompactCurrency(totals.actual)}
          delta={totalVarPlanAc}
          deltaLabel="vs plan"
        />
        <SmallStat
          label="Forecast vs Plan"
          value={fmtCompactCurrency(totalVarPlanRf)}
          tone={totalVarPlanRf >= 0 ? 'good' : 'bad'}
        />
      </div>

      <Card title="Channel-Level Variance" subtitle={`${monthName(month)} ${FY}`}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="text-right">Plan</th>
                <th className="text-right">Bottom-up Forecast</th>
                <th className="text-right">Actual (MTD)</th>
                <th className="text-right">Var: FC – Plan</th>
                <th className="text-right">Var: Act – Plan</th>
                <th className="text-right">% to Plan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.channel}>
                  <td className="font-medium">{r.channel}</td>
                  <td className="text-right font-mono">{fmtCompactCurrency(r.plan)}</td>
                  <td className="text-right font-mono">{fmtCompactCurrency(r.reforecast)}</td>
                  <td className="text-right font-mono">{fmtCompactCurrency(r.actual)}</td>
                  <td className={classNames('text-right font-mono', r.varPlanReforecast >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                    {r.varPlanReforecast >= 0 ? '+' : ''}{fmtCompactCurrency(r.varPlanReforecast)}
                  </td>
                  <td className={classNames('text-right font-mono', r.varPlanActual >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                    {r.varPlanActual >= 0 ? '+' : ''}{fmtCompactCurrency(r.varPlanActual)}
                  </td>
                  <td className="text-right font-mono">{fmtPct(r.pctActualPlan)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-semibold bg-slate-50">
              <tr>
                <td>Total</td>
                <td className="text-right font-mono">{fmtCompactCurrency(totals.plan)}</td>
                <td className="text-right font-mono">{fmtCompactCurrency(totals.reforecast)}</td>
                <td className="text-right font-mono">{fmtCompactCurrency(totals.actual)}</td>
                <td className={classNames('text-right font-mono', totalVarPlanRf >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                  {totalVarPlanRf >= 0 ? '+' : ''}{fmtCompactCurrency(totalVarPlanRf)}
                </td>
                <td className={classNames('text-right font-mono', totalVarPlanAc >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                  {totalVarPlanAc >= 0 ? '+' : ''}{fmtCompactCurrency(totalVarPlanAc)}
                </td>
                <td className="text-right font-mono">{fmtPct(totals.plan ? totals.actual / totals.plan : null)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}

function SmallStat({ label, value, delta, deltaLabel, tone }) {
  const toneCls = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : ''
  return (
    <Card className="!p-4">
      <div className="section-title">{label}</div>
      <div className={classNames('font-display text-2xl font-semibold mt-1', toneCls)}>{value}</div>
      {delta != null && (
        <div className={classNames('text-xs mt-0.5', delta >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
          {delta >= 0 ? '+' : ''}{fmtCompactCurrency(delta)} {deltaLabel}
        </div>
      )}
    </Card>
  )
}

// =============================================================================
// BRIDGE TAB — waterfall
// =============================================================================
function BridgeTab({ month, isManager, profile }) {
  const { rows: buckets } = useTable('bridge_buckets', { order: { column: 'sort_order' } })
  const { rows: plan }    = useTable('annual_plan')
  const { data: actuals } = useAsync(() => fetchByChannel(FY, month), [month])

  const [periodType, setPeriodType] = useState('quarter')
  const periodValue = periodType === 'quarter' ? Math.ceil(month / 3) : month

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const applicable = useMemo(() => {
    return buckets.filter(
      (b) => b.fiscal_year === FY && b.period_type === periodType && b.period_value === periodValue
    ).sort((a, b) => a.sort_order - b.sort_order)
  }, [buckets, periodType, periodValue])

  // Plan for the period (sum all channels × months-in-period)
  const planForPeriod = useMemo(() => {
    let months = []
    if (periodType === 'quarter') {
      const q = periodValue
      months = [3 * q - 2, 3 * q - 1, 3 * q]
    } else {
      months = [month]
    }
    return plan.filter((p) => p.fiscal_year === FY && months.includes(p.month))
      .reduce((s, p) => s + Number(p.planned_revenue || 0), 0)
  }, [plan, periodType, periodValue, month])

  const bucketImpact = applicable.reduce((s, b) => s + Number(b.dollar_impact || 0), 0)
  const projectedActual = planForPeriod + bucketImpact

  const waterfall = useMemo(() => {
    const data = []
    data.push({ name: 'Plan', start: 0, value: planForPeriod, kind: 'start' })
    let running = planForPeriod
    applicable.forEach((b) => {
      const val = Number(b.dollar_impact || 0)
      data.push({
        name: b.bucket_name,
        start: val >= 0 ? running : running + val,
        value: Math.abs(val),
        signedValue: val,
        kind: val >= 0 ? 'up' : 'down',
        commentary: b.commentary,
      })
      running += val
    })
    data.push({ name: 'Projected Actual', start: 0, value: running, kind: 'end' })
    return data
  }, [applicable, planForPeriod])

  async function handleDelete(b) {
    if (!confirm(`Delete bucket "${b.bucket_name}"?`)) return
    await deleteRow('bridge_buckets', b.id, profile)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-md p-0.5">
          <button
            onClick={() => setPeriodType('quarter')}
            className={classNames('px-3 py-1 text-sm rounded', periodType === 'quarter' ? 'bg-navy-900 text-white' : 'text-slate-600')}
          >
            Quarter
          </button>
          <button
            onClick={() => setPeriodType('month')}
            className={classNames('px-3 py-1 text-sm rounded', periodType === 'month' ? 'bg-navy-900 text-white' : 'text-slate-600')}
          >
            Month
          </button>
        </div>
        <div className="text-sm text-slate-600">
          Showing {periodType === 'quarter' ? `Q${periodValue}` : monthName(periodValue)} {FY}
        </div>
        {isManager && (
          <div className="ml-auto">
            <button onClick={() => setShowAdd(true)} className="btn btn-primary">
              <Plus size={14} /> Add bucket
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SmallStat label="Plan" value={fmtCompactCurrency(planForPeriod)} />
        <SmallStat
          label="Net Variance"
          value={fmtCompactCurrency(bucketImpact)}
          tone={bucketImpact >= 0 ? 'good' : 'bad'}
        />
        <SmallStat label="Projected Actual" value={fmtCompactCurrency(projectedActual)} />
      </div>

      <Card title="Plan-to-Actuals Bridge">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={waterfall} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                angle={-25}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis
                tickFormatter={(v) => `$${Math.round(v / 1000)}K`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload || !payload.length) return null
                  const d = payload[0].payload
                  const v = d.kind === 'start' || d.kind === 'end' ? d.value : d.signedValue
                  return (
                    <div className="bg-white border border-slate-200 rounded-md p-2 text-xs shadow-md max-w-xs">
                      <div className="font-semibold">{d.name}</div>
                      <div className={classNames('font-mono', v >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                        {v >= 0 && d.kind !== 'start' && d.kind !== 'end' ? '+' : ''}
                        {fmtCompactCurrency(v)}
                      </div>
                      {d.commentary && <div className="mt-1 text-slate-600">{d.commentary}</div>}
                    </div>
                  )
                }}
              />
              <Bar dataKey="start" stackId="s" fill="transparent" />
              <Bar dataKey="value" stackId="s" radius={[2, 2, 0, 0]}>
                {waterfall.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.kind === 'start' ? '#1c2d4a' :
                      d.kind === 'end'   ? '#0d9488' :
                      d.kind === 'up'    ? '#059669' :
                                           '#be123c'
                    }
                  />
                ))}
              </Bar>
              <ReferenceLine y={0} stroke="#cbd5e1" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Bucket Detail" subtitle="Each variance driver with $ impact, units, and commentary">
        {applicable.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No buckets yet for this period"
            description={isManager ? 'Add variance drivers to build the bridge.' : 'No buckets have been set up yet.'}
            action={isManager && (
              <button onClick={() => setShowAdd(true)} className="btn btn-primary">
                <Plus size={14} /> Add bucket
              </button>
            )}
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Bucket</th>
                <th className="text-right">$ Impact</th>
                <th className="text-right">% of Plan</th>
                <th className="text-right">Units</th>
                <th>Commentary</th>
                {isManager && <th></th>}
              </tr>
            </thead>
            <tbody>
              {applicable.map((b) => (
                editingId === b.id ? (
                  <EditingBucketRow key={b.id} bucket={b} profile={profile} onDone={() => setEditingId(null)} />
                ) : (
                  <tr key={b.id}>
                    <td className="font-medium">{b.bucket_name}</td>
                    <td className={classNames('text-right font-mono', Number(b.dollar_impact) >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                      {Number(b.dollar_impact) >= 0 ? '+' : ''}{fmtCompactCurrency(b.dollar_impact)}
                    </td>
                    <td className="text-right font-mono text-slate-600">
                      {planForPeriod ? fmtPct(Number(b.dollar_impact) / planForPeriod) : '—'}
                    </td>
                    <td className="text-right font-mono text-slate-600">{fmtNumber(b.units_impact)}</td>
                    <td className="text-sm text-slate-600">{b.commentary || '—'}</td>
                    {isManager && (
                      <td className="text-right whitespace-nowrap">
                        <button onClick={() => setEditingId(b.id)} className="btn btn-ghost !px-2"><Edit3 size={13} /></button>
                        <button onClick={() => handleDelete(b)} className="btn btn-ghost !px-2 text-rose-600"><Trash2 size={13} /></button>
                      </td>
                    )}
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showAdd && (
        <AddBucketModal
          onClose={() => setShowAdd(false)}
          periodType={periodType}
          periodValue={periodValue}
          existingCount={applicable.length}
          profile={profile}
        />
      )}
    </div>
  )
}

function EditingBucketRow({ bucket, profile, onDone }) {
  const [form, setForm] = useState({
    bucket_name: bucket.bucket_name,
    dollar_impact: bucket.dollar_impact,
    units_impact: bucket.units_impact || '',
    commentary: bucket.commentary || '',
  })
  async function save() {
    await updateRow('bridge_buckets', bucket.id, {
      bucket_name: form.bucket_name,
      dollar_impact: Number(form.dollar_impact),
      units_impact: form.units_impact ? Number(form.units_impact) : null,
      commentary: form.commentary || null,
    }, profile)
    onDone()
  }
  return (
    <tr className="bg-amber-50/60">
      <td><input className="input !py-1" value={form.bucket_name} onChange={(e) => setForm({ ...form, bucket_name: e.target.value })} /></td>
      <td><input type="number" className="input !py-1 text-right font-mono" value={form.dollar_impact} onChange={(e) => setForm({ ...form, dollar_impact: e.target.value })} /></td>
      <td></td>
      <td><input type="number" className="input !py-1 text-right font-mono" value={form.units_impact} onChange={(e) => setForm({ ...form, units_impact: e.target.value })} /></td>
      <td><input className="input !py-1" value={form.commentary} onChange={(e) => setForm({ ...form, commentary: e.target.value })} /></td>
      <td className="text-right whitespace-nowrap">
        <button onClick={save} className="btn btn-primary !py-1 !px-2"><Check size={13} /></button>
        <button onClick={onDone} className="btn btn-ghost !py-1 !px-2 ml-1"><XIcon size={13} /></button>
      </td>
    </tr>
  )
}

function AddBucketModal({ onClose, periodType, periodValue, existingCount, profile }) {
  const [form, setForm] = useState({ bucket_name: '', dollar_impact: '', units_impact: '', commentary: '' })
  const [saving, setSaving] = useState(false)
  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await insertRow('bridge_buckets', {
        fiscal_year: FY,
        period_type: periodType,
        period_value: periodValue,
        bucket_name: form.bucket_name,
        dollar_impact: Number(form.dollar_impact),
        units_impact: form.units_impact ? Number(form.units_impact) : null,
        commentary: form.commentary || null,
        sort_order: existingCount + 1,
      }, profile)
      onClose()
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal open onClose={onClose} title="Add bridge bucket">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Bucket name">
          <input className="input" required value={form.bucket_name} onChange={(e) => setForm({ ...form, bucket_name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dollar impact ($, signed)">
            <input type="number" required className="input" value={form.dollar_impact} onChange={(e) => setForm({ ...form, dollar_impact: e.target.value })} />
          </Field>
          <Field label="Units impact (optional)">
            <input type="number" className="input" value={form.units_impact} onChange={(e) => setForm({ ...form, units_impact: e.target.value })} />
          </Field>
        </div>
        <Field label="Commentary">
          <textarea rows="2" className="input" value={form.commentary} onChange={(e) => setForm({ ...form, commentary: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
