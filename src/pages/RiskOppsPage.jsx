import { useMemo, useState } from 'react'
import {
  Plus, AlertTriangle, Sparkles, Trash2, Edit3, MessageCircle, TrendingUp,
  Calendar, X as XIcon, ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTable, insertRow, updateRow, deleteRow } from '../hooks/useTable'
import { Card, Tag, Modal, EmptyState, RagDot } from '../components/ui/Primitives'
import { fmtCompactCurrency, fmtPct, fmtDate, fmtRelative, classNames } from '../lib/format'

const CHANNELS = ['', 'Conventional', 'New Distribution', 'Wholesale', 'Chains', 'Inbound', 'B2C', 'Field Sales']

export default function RiskOppsPage() {
  const { profile, isManager, canWrite } = useAuth()
  const { rows: items }    = useTable('ro_items', { order: { column: 'updated_at', ascending: false } })
  const { rows: profiles } = useTable('profiles')

  const [filter, setFilter] = useState({
    type: 'all',
    classification: 'all',
    channel: 'all',
    status: 'open',
    owner: 'all',
  })
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [commentsOn, setCommentsOn] = useState(null)

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (filter.type !== 'all' && r.item_type !== filter.type) return false
      if (filter.classification !== 'all' && r.classification !== filter.classification) return false
      if (filter.channel !== 'all' && r.sales_channel !== filter.channel) return false
      if (filter.status !== 'all') {
        if (filter.status === 'open' && !['open', 'in_progress'].includes(r.status)) return false
        if (filter.status === 'closed' && !['closed_won', 'closed_lost'].includes(r.status)) return false
      }
      if (filter.owner !== 'all' && r.owner !== filter.owner) return false
      return true
    })
  }, [items, filter])

  const totals = useMemo(() => {
    const risks = filtered.filter((r) => r.item_type === 'risk')
    const opps = filtered.filter((r) => r.item_type === 'opportunity')
    const goGets = opps.filter((r) => r.classification === 'incremental')
    const riskEV = risks.reduce((s, r) => s + Number(r.expected_value || 0), 0)
    const oppEV  = opps.reduce((s, r) => s + Number(r.expected_value || 0), 0)
    const goGetEV = goGets.reduce((s, r) => s + Number(r.expected_value || 0), 0)
    const baseRiskEV = risks.filter((r) => r.classification === 'base').reduce((s, r) => s + Number(r.expected_value || 0), 0)
    const incRiskEV  = risks.filter((r) => r.classification === 'incremental').reduce((s, r) => s + Number(r.expected_value || 0), 0)
    return {
      riskEV, oppEV, net: riskEV + oppEV, baseRiskEV, incRiskEV,
      riskCount: risks.length, oppCount: opps.length,
      goGetCount: goGets.length, goGetEV,
    }
  }, [filtered])

  async function handleDelete(r) {
    if (!confirm(`Delete: "${r.description}"?`)) return
    await deleteRow('ro_items', r.id, profile)
  }

  async function handleStatusChange(r, status) {
    await updateRow('ro_items', r.id, { status }, profile)
  }

  return (
    <div className="space-y-4">
      {/* Cascade explainer */}
      {totals.goGetCount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-900 flex items-center gap-2">
          <ArrowUpRight size={14} className="text-emerald-700 flex-shrink-0" />
          <span>
            <span className="font-semibold">{totals.goGetCount} incremental opportunit{totals.goGetCount === 1 ? 'y' : 'ies'}</span> ({fmtCompactCurrency(totals.goGetEV)} total EV) {totals.goGetCount === 1 ? 'is' : 'are'} appearing as Go Get rows in the Forecast Grid. Promote to Base when committed.
          </span>
        </div>
      )}

      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="!p-4">
          <div className="section-title flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-rose-500" /> Total Risk EV
          </div>
          <div className="font-display text-2xl font-semibold mt-1 text-rose-700">
            {fmtCompactCurrency(totals.riskEV)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{totals.riskCount} open</div>
        </Card>
        <Card className="!p-4">
          <div className="section-title flex items-center gap-1.5">
            <Sparkles size={12} className="text-emerald-600" /> Total Opp EV
          </div>
          <div className="font-display text-2xl font-semibold mt-1 text-emerald-700">
            +{fmtCompactCurrency(totals.oppEV)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{totals.oppCount} open</div>
        </Card>
        <Card className="!p-4">
          <div className="section-title">Net Position</div>
          <div className={classNames(
            'font-display text-2xl font-semibold mt-1',
            totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
          )}>
            {totals.net >= 0 ? '+' : ''}{fmtCompactCurrency(totals.net)}
          </div>
        </Card>
        <Card className="!p-4">
          <div className="section-title">Risk by Classification</div>
          <div className="mt-1.5 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Base</span>
              <span className="font-mono font-semibold">{fmtCompactCurrency(totals.baseRiskEV)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Incremental</span>
              <span className="font-mono font-semibold">{fmtCompactCurrency(totals.incRiskEV)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* FILTERS */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect label="Type" value={filter.type} onChange={(v) => setFilter({ ...filter, type: v })}
            options={[
              ['all', 'All'], ['risk', 'Risks only'], ['opportunity', 'Opportunities only']
            ]}
          />
          <FilterSelect label="Classification" value={filter.classification} onChange={(v) => setFilter({ ...filter, classification: v })}
            options={[['all', 'All'], ['base', 'Base'], ['incremental', 'Incremental']]}
          />
          <FilterSelect label="Channel" value={filter.channel} onChange={(v) => setFilter({ ...filter, channel: v })}
            options={[['all', 'All'], ...CHANNELS.filter(Boolean).map((c) => [c, c])]}
          />
          <FilterSelect label="Status" value={filter.status} onChange={(v) => setFilter({ ...filter, status: v })}
            options={[['open', 'Open / In Progress'], ['closed', 'Closed'], ['all', 'All']]}
          />
          <FilterSelect label="Owner" value={filter.owner} onChange={(v) => setFilter({ ...filter, owner: v })}
            options={[['all', 'All'], ...profiles.map((p) => [p.id, p.full_name])]}
          />
          <div className="ml-auto">
            {canWrite && (
              <button onClick={() => setShowAdd(true)} className="btn btn-primary">
                <Plus size={14} /> Add item
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* LIST */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No items match these filters"
            description="Try relaxing the filters, or add a new risk or opportunity."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const aging = isAging(r.updated_at)
            return (
              <article
                key={r.id}
                className={classNames(
                  'card p-4',
                  r.item_type === 'risk'
                    ? 'border-l-4 border-l-rose-400'
                    : 'border-l-4 border-l-emerald-400'
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={classNames(
                        'tag',
                        r.item_type === 'risk' ? 'tag-red' : 'tag-green'
                      )}>
                        {r.item_type}
                      </span>
                      {r.classification && (
                        <Tag color={r.classification === 'base' ? 'slate' : 'amber'}>
                          {r.classification}
                        </Tag>
                      )}
                      {r.item_type === 'opportunity' && r.classification === 'incremental' && (
                        <Tag color="green" title="Auto-synthesized as a Go Get row in the Forecast Grid">
                          ↗ On Grid · Go Get
                        </Tag>
                      )}
                      <Tag color={statusColor(r.status)}>{r.status.replace('_', ' ')}</Tag>
                      {r.sales_channel && <Tag color="blue">{r.sales_channel}</Tag>}
                      {aging && <Tag color="red">No update · {aging}d</Tag>}
                    </div>
                    <h3 className="font-display text-base font-semibold mt-2">{r.description}</h3>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                      <span>Owner: <span className="font-medium text-slate-700">{r.owner_name || '—'}</span></span>
                      {r.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> Due {fmtDate(r.due_date)}
                        </span>
                      )}
                      <span>Updated {fmtRelative(r.updated_at)}</span>
                    </div>
                    {r.next_steps && (
                      <div className="mt-2 text-sm text-slate-700 bg-slate-50 rounded-md px-3 py-2">
                        <span className="font-semibold text-slate-500 text-xs uppercase tracking-wider mr-1">
                          Next steps
                        </span>
                        {r.next_steps}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 text-right">
                    <div className={classNames(
                      'font-display text-2xl font-semibold',
                      r.item_type === 'risk' ? 'text-rose-700' : 'text-emerald-700'
                    )}>
                      {Number(r.expected_value) >= 0 ? '+' : ''}{fmtCompactCurrency(r.expected_value)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Mid {fmtCompactCurrency(r.impact_mid)} × {fmtPct(r.probability, { decimals: 0 })}
                    </div>
                    <div className="text-xs text-slate-400">
                      {fmtCompactCurrency(r.impact_low)} – {fmtCompactCurrency(r.impact_high)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <button onClick={() => setCommentsOn(r)} className="btn btn-ghost text-xs">
                    <MessageCircle size={13} /> Comments
                  </button>
                  {isManager && r.classification === 'incremental' && r.item_type === 'opportunity' && (
                    <button
                      onClick={async () => {
                        await updateRow('ro_items', r.id, { classification: 'base' }, profile)
                      }}
                      className="btn btn-ghost text-xs"
                      title="Promote to base — bake into forecast"
                    >
                      <ArrowUpRight size={13} /> Promote to base
                    </button>
                  )}
                  {canWrite && isManager && (
                    <>
                      <select
                        value={r.status}
                        onChange={(e) => handleStatusChange(r, e.target.value)}
                        className="input !w-auto !py-1 !text-xs ml-auto"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="closed_won">Closed Won</option>
                        <option value="closed_lost">Closed Lost</option>
                      </select>
                      <button onClick={() => setEditing(r)} className="btn btn-ghost !px-2">
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => handleDelete(r)} className="btn btn-ghost !px-2 text-rose-600">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {showAdd && <ROModal onClose={() => setShowAdd(false)} profile={profile} profiles={profiles} />}
      {editing && <ROModal onClose={() => setEditing(null)} profile={profile} profiles={profiles} item={editing} />}
      {commentsOn && <CommentsModal onClose={() => setCommentsOn(null)} entity={commentsOn} entityType="ro_items" profile={profile} />}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <select className="input !w-auto" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
      </select>
    </label>
  )
}

function statusColor(s) {
  return {
    open: 'amber',
    in_progress: 'blue',
    closed_won: 'green',
    closed_lost: 'slate',
  }[s] || 'slate'
}

function isAging(updated_at) {
  const d = Math.floor((Date.now() - new Date(updated_at).getTime()) / (1000 * 60 * 60 * 24))
  return d >= 7 ? d : null
}

// -----------------------------------------------------------------------------
// Add / Edit modal
// -----------------------------------------------------------------------------
function ROModal({ onClose, profile, profiles, item }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    item_type: item?.item_type || 'risk',
    description: item?.description || '',
    sales_channel: item?.sales_channel || '',
    owner: item?.owner || profile.id,
    impact_low: item?.impact_low ?? '',
    impact_mid: item?.impact_mid ?? '',
    impact_high: item?.impact_high ?? '',
    probability: item?.probability != null ? Math.round(item.probability * 100) : 50,
    classification: item?.classification || 'base',
    next_steps: item?.next_steps || '',
    due_date: item?.due_date || '',
  })
  const [saving, setSaving] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const ownerProfile = profiles.find((p) => p.id === form.owner)
      const values = {
        item_type: form.item_type,
        description: form.description,
        sales_channel: form.sales_channel || null,
        owner: form.owner || null,
        owner_name: ownerProfile?.full_name || null,
        impact_low:  form.impact_low  === '' ? null : Number(form.impact_low),
        impact_mid:  form.impact_mid  === '' ? null : Number(form.impact_mid),
        impact_high: form.impact_high === '' ? null : Number(form.impact_high),
        probability: Number(form.probability) / 100,
        classification: form.classification,
        next_steps: form.next_steps || null,
        due_date: form.due_date || null,
      }
      if (isEdit) {
        await updateRow('ro_items', item.id, values, profile)
      } else {
        await insertRow('ro_items', { ...values, status: 'open' }, profile)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const midNum = Number(form.impact_mid) || 0
  const prob = Number(form.probability) / 100
  const ev = midNum * prob

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit item' : 'Add risk / opportunity'} maxWidth="max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="input" value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>
              <option value="risk">Risk</option>
              <option value="opportunity">Opportunity</option>
            </select>
          </Field>
          <Field label="Classification">
            <select className="input" value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value })}>
              <option value="base">Base (baked into forecast)</option>
              <option value="incremental">Incremental (not yet baked)</option>
            </select>
          </Field>
        </div>
        <Field label="Description">
          <input required className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Channel (optional)">
            <select className="input" value={form.sales_channel} onChange={(e) => setForm({ ...form, sales_channel: e.target.value })}>
              <option value="">—</option>
              {CHANNELS.filter(Boolean).map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <select className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Impact Low ($)">
            <input type="number" className="input" value={form.impact_low} onChange={(e) => setForm({ ...form, impact_low: e.target.value })} />
          </Field>
          <Field label="Impact Mid ($)">
            <input type="number" className="input" value={form.impact_mid} onChange={(e) => setForm({ ...form, impact_mid: e.target.value })} />
          </Field>
          <Field label="Impact High ($)">
            <input type="number" className="input" value={form.impact_high} onChange={(e) => setForm({ ...form, impact_high: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Probability: ${form.probability}%`}>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={form.probability}
              onChange={(e) => setForm({ ...form, probability: e.target.value })}
              className="w-full"
            />
          </Field>
          <Field label="Due date">
            <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
        </div>
        <Field label="Next steps">
          <textarea rows="2" className="input" value={form.next_steps} onChange={(e) => setForm({ ...form, next_steps: e.target.value })} />
        </Field>
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm flex items-center justify-between">
          <span className="text-slate-600">Calculated Expected Value:</span>
          <span className={classNames(
            'font-mono font-semibold',
            ev >= 0 ? 'text-emerald-700' : 'text-rose-700'
          )}>
            {ev >= 0 ? '+' : ''}{fmtCompactCurrency(ev)}
          </span>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add item')}
          </button>
        </div>
      </form>
    </Modal>
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

// -----------------------------------------------------------------------------
// Comments modal (reusable across entities)
// -----------------------------------------------------------------------------
export function CommentsModal({ onClose, entity, entityType, profile }) {
  const { rows: comments } = useTable('comments', { order: { column: 'created_at', ascending: true } })
  const [text, setText] = useState('')

  const mine = comments.filter((c) => c.entity_type === entityType && c.entity_id === entity.id)

  async function onPost() {
    if (!text.trim()) return
    await insertRow('comments', {
      entity_type: entityType,
      entity_id: entity.id,
      user_id: profile.id,
      user_name: profile.full_name,
      content: text.trim(),
    }, profile)
    setText('')
  }

  return (
    <Modal open onClose={onClose} title="Comments" maxWidth="max-w-lg">
      <div className="text-sm text-slate-600 mb-3 line-clamp-2">
        <span className="font-semibold">Re:</span> {entity.description || entity.name}
      </div>
      <div className="space-y-3 max-h-64 overflow-y-auto border border-slate-100 rounded-md p-3 bg-slate-50">
        {mine.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4">No comments yet.</div>
        ) : (
          mine.map((c) => (
            <div key={c.id} className="text-sm bg-white rounded-md p-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{c.user_name}</span>
                <span className="text-xs text-slate-400">{fmtRelative(c.created_at)}</span>
              </div>
              <div className="mt-1 whitespace-pre-wrap">{c.content}</div>
            </div>
          ))
        )}
      </div>
      <div className="mt-3">
        <textarea
          rows="2"
          className="input"
          placeholder="Add a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="btn btn-secondary">Close</button>
          <button onClick={onPost} disabled={!text.trim()} className="btn btn-primary">Post</button>
        </div>
      </div>
    </Modal>
  )
}
