import { useMemo, useState } from 'react'
import {
  Plus, Edit3, Trash2, Lock, ChevronRight, Sliders, MessageCircle,
  Link2, Award, ArrowLeft, ArrowRight, ArrowUpRight, Check,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTable, insertRow, updateRow, deleteRow } from '../hooks/useTable'
import { Card, Tag, Modal, EmptyState } from '../components/ui/Primitives'
import { fmtCompactCurrency, classNames } from '../lib/format'
import { CommentsModal } from './RiskOppsPage'

const STAGES = [
  { key: 'idea',         label: 'Idea' },
  { key: 'evaluating',   label: 'Evaluating' },
  { key: 'approved',     label: 'Approved' },
  { key: 'in_execution', label: 'In Execution' },
  { key: 'complete',     label: 'Complete' },
]

const CHANNELS = ['', 'Conventional', 'New Distribution', 'Wholesale', 'Chains', 'Inbound', 'B2C']

export default function InitiativesPage() {
  const { profile, isManager, canWrite } = useAuth()
  const { rows: initiatives } = useTable('initiatives', { order: { column: 'updated_at', ascending: false } })
  const { rows: profiles }    = useTable('profiles')
  const { rows: weights }     = useTable('scoring_weights')
  const { rows: roItems }     = useTable('ro_items')
  const { rows: promos }      = useTable('promos')

  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [commentsOn, setCommentsOn] = useState(null)
  const [showWeights, setShowWeights] = useState(false)
  const [showRanking, setShowRanking] = useState(false)

  // Confidential items: only managers see them
  const visible = useMemo(
    () => initiatives.filter((i) => !i.confidential || isManager),
    [initiatives, isManager]
  )

  // Compute composite score (golf-style: lowest wins)
  const scored = useMemo(() => {
    const w = Object.fromEntries(weights.map((x) => [x.criterion, Number(x.weight)]))
    return visible.map((i) => ({ ...i, composite_score: computeScore(i, w) }))
  }, [visible, weights])

  const byStage = useMemo(() => {
    const buckets = Object.fromEntries(STAGES.map((s) => [s.key, []]))
    for (const i of scored) {
      if (buckets[i.stage]) buckets[i.stage].push(i)
    }
    for (const k in buckets) buckets[k].sort((a, b) => (a.composite_score ?? 1e9) - (b.composite_score ?? 1e9))
    return buckets
  }, [scored])

  async function moveStage(item, direction) {
    const idx = STAGES.findIndex((s) => s.key === item.stage)
    const next = Math.max(0, Math.min(STAGES.length - 1, idx + direction))
    if (next === idx) return
    await updateRow('initiatives', item.id, { stage: STAGES[next].key }, profile)
  }

  async function handleDelete(i) {
    if (!confirm(`Delete initiative "${i.name}"?`)) return
    await deleteRow('initiatives', i.id, profile)
  }

  /**
   * Convert an Initiative to an R&O Opportunity. Creates a new ro_items row
   * (classification = 'incremental', item_type = 'opportunity') and links the
   * initiative back via linked_ro_id. The new R&O will then auto-appear as a
   * "Go Get" row in the Forecast Grid for its channel.
   */
  async function convertToRO(i) {
    if (i.linked_ro_id) {
      const existing = roItems.find((r) => r.id === i.linked_ro_id)
      if (existing) {
        alert(`This initiative already has a linked R&O: "${existing.description}".`)
        return
      }
    }
    const mid = Number(i.revenue_potential || 0)
    const confidenceToProb = { high: 0.8, medium: 0.5, low: 0.25 }
    const probability = confidenceToProb[i.confidence_level] ?? 0.5
    if (!confirm(`Create an R&O Opportunity for "${i.name}"?\n\nIt will appear as a Go Get row on the Forecast Grid for ${i.sales_channel || 'all channels'}.`)) return

    const ro = await insertRow('ro_items', {
      item_type: 'opportunity',
      classification: 'incremental',
      description: i.name,
      sales_channel: i.sales_channel || null,
      owner: i.owner || null,
      owner_name: i.owner_name || null,
      impact_low: Math.round(mid * 0.6),
      impact_mid: mid,
      impact_high: Math.round(mid * 1.4),
      probability,
      status: 'in_progress',
      next_steps: i.dependencies || null,
      due_date: null,
    }, profile)
    await updateRow('initiatives', i.id, { linked_ro_id: ro.id }, profile)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => setShowRanking(true)} className="btn btn-secondary">
          <Award size={14} /> Ranked list
        </button>
        {isManager && (
          <button onClick={() => setShowWeights(true)} className="btn btn-secondary">
            <Sliders size={14} /> Scoring weights
          </button>
        )}
        {canWrite && (
          <button onClick={() => setShowAdd(true)} className="btn btn-primary">
            <Plus size={14} /> New initiative
          </button>
        )}
      </div>

      {/* KANBAN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STAGES.map((stage) => (
          <div key={stage.key} className="bg-white rounded-lg border border-slate-200 flex flex-col min-h-[300px]">
            <header className="px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{stage.label}</h3>
                <Tag color="slate">{byStage[stage.key].length}</Tag>
              </div>
            </header>
            <div className="p-2 space-y-2 flex-1">
              {byStage[stage.key].length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-8">No items</div>
              ) : (
                byStage[stage.key].map((i) => {
                  const canMoveForward = stage.key !== 'complete' && (isManager || (stage.key === 'idea' && i.created_by === profile.id))
                  const canMoveBack = stage.key !== 'idea' && isManager
                  return (
                    <article
                      key={i.id}
                      className="border border-slate-200 rounded-md p-2.5 hover:shadow-card-hover transition-shadow bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm leading-tight">{i.name}</h4>
                        {i.confidential && <Lock size={12} className="text-amber-600 flex-shrink-0" />}
                      </div>
                      {i.description && (
                        <div className="text-xs text-slate-600 mt-1 line-clamp-2">{i.description}</div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {i.revenue_potential > 0 && (
                          <Tag color="green">{fmtCompactCurrency(i.revenue_potential)}</Tag>
                        )}
                        {i.confidence_level && <Tag color={
                          i.confidence_level === 'high' ? 'green' :
                          i.confidence_level === 'medium' ? 'amber' : 'red'
                        }>{i.confidence_level}</Tag>}
                        {i.composite_score != null && (
                          <Tag color="violet" className="font-mono">
                            #{i.composite_score.toFixed(1)}
                          </Tag>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-2">
                        {i.owner_name}
                        {i.time_to_execute && ` · ${i.time_to_execute}`}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-0.5 justify-between">
                        <div className="flex gap-0.5">
                          <button
                            disabled={!canMoveBack}
                            onClick={() => moveStage(i, -1)}
                            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move back"
                          >
                            <ArrowLeft size={12} />
                          </button>
                          <button
                            disabled={!canMoveForward}
                            onClick={() => moveStage(i, 1)}
                            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move forward"
                          >
                            <ArrowRight size={12} />
                          </button>
                        </div>
                        <div className="flex gap-0.5">
                          <button onClick={() => setCommentsOn(i)} className="p-1 rounded hover:bg-slate-100" title="Comments">
                            <MessageCircle size={12} />
                          </button>
                          {canWrite && (
                            <button
                              onClick={() => convertToRO(i)}
                              className={classNames(
                                'p-1 rounded hover:bg-slate-100',
                                i.linked_ro_id ? 'text-emerald-600' : ''
                              )}
                              title={i.linked_ro_id ? 'Linked to R&O — click for details' : 'Convert to R&O Opportunity (creates Go Get on grid)'}
                              disabled={!!i.linked_ro_id}
                            >
                              {i.linked_ro_id ? <Check size={12} /> : <ArrowUpRight size={12} />}
                            </button>
                          )}
                          {(isManager || i.created_by === profile.id) && (
                            <button onClick={() => setEditing(i)} className="p-1 rounded hover:bg-slate-100" title="Edit">
                              <Edit3 size={12} />
                            </button>
                          )}
                          {isManager && (
                            <button onClick={() => handleDelete(i)} className="p-1 rounded hover:bg-slate-100 text-rose-600" title="Delete">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {showAdd    && <InitiativeModal onClose={() => setShowAdd(false)}    profile={profile} profiles={profiles} roItems={roItems} promos={promos} isManager={isManager} />}
      {editing    && <InitiativeModal onClose={() => setEditing(null)}     profile={profile} profiles={profiles} roItems={roItems} promos={promos} isManager={isManager} item={editing} />}
      {commentsOn && <CommentsModal   onClose={() => setCommentsOn(null)}  entity={commentsOn} entityType="initiatives" profile={profile} />}
      {showWeights && isManager && <WeightsModal onClose={() => setShowWeights(false)} weights={weights} profile={profile} />}
      {showRanking && <RankingModal onClose={() => setShowRanking(false)} items={scored} />}
    </div>
  )
}

// Composite score: normalize each dimension to 1..5 (where 1 = best per golf scoring),
// then weighted sum. Lower = better. Each dimension contributes equally in shape;
// the weights let managers dial up relative importance.
function computeScore(i, w) {
  const weights = {
    revenue_potential:   w.revenue_potential   ?? 3.0,
    ops_difficulty:      w.ops_difficulty      ?? 2.5,
    strategic_alignment: w.strategic_alignment ?? 2.0,
    time_to_execute:     w.time_to_execute     ?? 1.5,
    required_investment: w.required_investment ?? 1.0,
  }
  const parts = []
  // revenue: higher is better → invert (1 = highest)
  if (i.revenue_potential != null) {
    const bucket =
      i.revenue_potential >= 1_000_000 ? 1 :
      i.revenue_potential >=   500_000 ? 2 :
      i.revenue_potential >=   250_000 ? 3 :
      i.revenue_potential >=   100_000 ? 4 : 5
    parts.push([bucket, weights.revenue_potential])
  }
  // ops difficulty: lower difficulty is better → 1 is best already (1..5 stored)
  if (i.ops_difficulty != null) parts.push([i.ops_difficulty, weights.ops_difficulty])
  // strategic alignment: higher is better → invert
  if (i.strategic_alignment != null) parts.push([6 - i.strategic_alignment, weights.strategic_alignment])
  // time to execute: rough bucket by string
  if (i.time_to_execute) {
    const s = i.time_to_execute.toLowerCase()
    const bucket =
      /\b(this|next) month\b|q2/.test(s) ? 1 :
      /q3|this (quarter|year)/.test(s) ? 2 :
      /q4/.test(s) ? 3 :
      /q1.*2027/.test(s) || /\b2027\b/.test(s) ? 4 : 3
    parts.push([bucket, weights.time_to_execute])
  }
  // required investment: lower is better → bucket
  if (i.required_investment != null) {
    const bucket =
      i.required_investment <=  10_000 ? 1 :
      i.required_investment <=  50_000 ? 2 :
      i.required_investment <= 150_000 ? 3 :
      i.required_investment <= 300_000 ? 4 : 5
    parts.push([bucket, weights.required_investment])
  }
  if (!parts.length) return null
  const num = parts.reduce((s, [v, w]) => s + v * w, 0)
  const den = parts.reduce((s, [, w]) => s + w, 0)
  return num / den
}

// --- initiative add/edit modal --------------------------------------------
function InitiativeModal({ onClose, profile, profiles, roItems, promos, isManager, item }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    owner: item?.owner || profile.id,
    sales_channel: item?.sales_channel || '',
    stage: item?.stage || 'idea',
    revenue_potential: item?.revenue_potential ?? '',
    ops_difficulty: item?.ops_difficulty ?? 3,
    strategic_alignment: item?.strategic_alignment ?? 3,
    time_to_execute: item?.time_to_execute || '',
    required_investment: item?.required_investment ?? '',
    dependencies: item?.dependencies || '',
    confidence_level: item?.confidence_level || 'medium',
    confidential: !!item?.confidential,
    linked_ro_id: item?.linked_ro_id || '',
    linked_promo_id: item?.linked_promo_id || '',
  })
  const [saving, setSaving] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const ownerProfile = profiles.find((p) => p.id === form.owner)
      const values = {
        name: form.name,
        description: form.description || null,
        owner: form.owner || null,
        owner_name: ownerProfile?.full_name || null,
        sales_channel: form.sales_channel || null,
        stage: form.stage,
        revenue_potential: form.revenue_potential === '' ? null : Number(form.revenue_potential),
        ops_difficulty: Number(form.ops_difficulty),
        strategic_alignment: Number(form.strategic_alignment),
        time_to_execute: form.time_to_execute || null,
        required_investment: form.required_investment === '' ? null : Number(form.required_investment),
        dependencies: form.dependencies || null,
        confidence_level: form.confidence_level,
        confidential: form.confidential,
        linked_ro_id: form.linked_ro_id || null,
        linked_promo_id: form.linked_promo_id || null,
      }
      if (isEdit) await updateRow('initiatives', item.id, values, profile)
      else        await insertRow('initiatives', { ...values, created_by: profile.id }, profile)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit initiative' : 'New initiative'} maxWidth="max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Name">
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea rows="2" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <select className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Field>
          <Field label="Channel (optional)">
            <select className="input" value={form.sales_channel} onChange={(e) => setForm({ ...form, sales_channel: e.target.value })}>
              <option value="">—</option>
              {CHANNELS.filter(Boolean).map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Stage">
            <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} disabled={!isManager && form.stage !== 'idea'}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Time to execute">
            <input className="input" value={form.time_to_execute} onChange={(e) => setForm({ ...form, time_to_execute: e.target.value })} placeholder="Q3 2026" />
          </Field>
          <Field label="Revenue potential ($)">
            <input type="number" className="input" value={form.revenue_potential} onChange={(e) => setForm({ ...form, revenue_potential: e.target.value })} />
          </Field>
          <Field label="Required investment ($)">
            <input type="number" className="input" value={form.required_investment} onChange={(e) => setForm({ ...form, required_investment: e.target.value })} />
          </Field>
          <Field label={`Ops difficulty: ${form.ops_difficulty}/5 (1=easy)`}>
            <input type="range" min="1" max="5" value={form.ops_difficulty} onChange={(e) => setForm({ ...form, ops_difficulty: e.target.value })} className="w-full" />
          </Field>
          <Field label={`Strategic alignment: ${form.strategic_alignment}/5 (5=best)`}>
            <input type="range" min="1" max="5" value={form.strategic_alignment} onChange={(e) => setForm({ ...form, strategic_alignment: e.target.value })} className="w-full" />
          </Field>
          <Field label="Confidence">
            <select className="input" value={form.confidence_level} onChange={(e) => setForm({ ...form, confidence_level: e.target.value })}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </Field>
          {isManager && (
            <Field label="Confidential">
              <label className="flex items-center gap-2 mt-1.5">
                <input
                  type="checkbox"
                  checked={form.confidential}
                  onChange={(e) => setForm({ ...form, confidential: e.target.checked })}
                />
                <span className="text-sm text-slate-600">Only managers can see this item</span>
              </label>
            </Field>
          )}
        </div>
        <Field label="Dependencies">
          <textarea rows="2" className="input" value={form.dependencies} onChange={(e) => setForm({ ...form, dependencies: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Link to R&O item (optional)">
            <select className="input" value={form.linked_ro_id} onChange={(e) => setForm({ ...form, linked_ro_id: e.target.value })}>
              <option value="">—</option>
              {roItems.map((r) => <option key={r.id} value={r.id}>{r.description.slice(0, 60)}</option>)}
            </select>
          </Field>
          <Field label="Link to promo (optional)">
            <select className="input" value={form.linked_promo_id} onChange={(e) => setForm({ ...form, linked_promo_id: e.target.value })}>
              <option value="">—</option>
              {promos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function WeightsModal({ onClose, weights, profile }) {
  const [local, setLocal] = useState(Object.fromEntries(weights.map((w) => [w.id, w.weight])))
  const [saving, setSaving] = useState(false)

  async function onSave() {
    setSaving(true)
    try {
      for (const w of weights) {
        if (Number(local[w.id]) !== Number(w.weight)) {
          await updateRow('scoring_weights', w.id, { weight: Number(local[w.id]) }, profile)
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Scoring weights" maxWidth="max-w-md">
      <p className="text-sm text-slate-600 mb-4">
        Adjust how each criterion is weighted in the composite score.
        Lower composite = higher priority (golf-style).
      </p>
      <div className="space-y-3">
        {weights.map((w) => (
          <div key={w.id} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium">{labelForCriterion(w.criterion)}</div>
            </div>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              className="input !w-24"
              value={local[w.id]}
              onChange={(e) => setLocal({ ...local, [w.id]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
        <button onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button onClick={onSave} disabled={saving} className="btn btn-primary">
          {saving ? 'Saving…' : 'Save weights'}
        </button>
      </div>
    </Modal>
  )
}

function labelForCriterion(c) {
  return {
    revenue_potential:   'Revenue potential',
    ops_difficulty:      'Ops difficulty',
    strategic_alignment: 'Strategic alignment',
    time_to_execute:     'Time to execute',
    required_investment: 'Required investment',
  }[c] || c
}

function RankingModal({ onClose, items }) {
  const ranked = items
    .filter((i) => i.composite_score != null)
    .sort((a, b) => a.composite_score - b.composite_score)
  return (
    <Modal open onClose={onClose} title="Initiative ranking" maxWidth="max-w-2xl">
      <p className="text-sm text-slate-600 mb-4">Golf-style scoring — lower composite score ranks higher.</p>
      {ranked.length === 0 ? (
        <EmptyState icon={Award} title="No scored initiatives yet" description="Fill in scoring inputs on an initiative to see it here." />
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Stage</th>
              <th className="text-right">Revenue Pot.</th>
              <th className="text-right">Composite</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((i, idx) => (
              <tr key={i.id}>
                <td className="font-mono">{idx + 1}</td>
                <td className="font-medium">{i.name}</td>
                <td><Tag color="slate">{i.stage.replace('_', ' ')}</Tag></td>
                <td className="text-right font-mono">{fmtCompactCurrency(i.revenue_potential)}</td>
                <td className="text-right font-mono font-semibold">{i.composite_score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
