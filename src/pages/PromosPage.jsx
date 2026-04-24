import { useMemo, useState } from 'react'
import {
  Plus, Edit3, Trash2, Calendar, AlertCircle, Package, Link2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTable, insertRow, updateRow, deleteRow } from '../hooks/useTable'
import { Card, Tag, Modal, EmptyState } from '../components/ui/Primitives'
import { fmtCompactCurrency, fmtDate, classNames, monthName, MONTHS } from '../lib/format'

const CHANNELS = ['Conventional', 'New Distribution', 'Wholesale', 'Chains', 'Inbound', 'B2C']
const REGIONS = ['Florida', 'West', 'North', 'South', 'East']

// Tentpole / holiday markers to overlay on the calendar
const TENTPOLES = [
  { date: '2026-01-01', label: 'New Year' },
  { date: '2026-02-14', label: "Valentine's" },
  { date: '2026-05-25', label: 'Memorial Day' },
  { date: '2026-07-04', label: '4th of July' },
  { date: '2026-09-07', label: 'Labor Day' },
  { date: '2026-10-31', label: 'Halloween' },
  { date: '2026-11-26', label: 'Thanksgiving' },
  { date: '2026-12-25', label: 'Christmas' },
]

export default function PromosPage() {
  const { profile, isManager, canWrite } = useAuth()
  const { rows: promos } = useTable('promos', { order: { column: 'start_date' } })
  const { rows: initiatives } = useTable('initiatives')

  const [view, setView] = useState('quarter') // quarter | month | list
  const [year, setYear] = useState(2026)
  const [quarter, setQuarter] = useState(2)
  const [month, setMonth] = useState(4)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)

  const displayed = useMemo(() => {
    if (view === 'list') return promos
    const months = view === 'quarter'
      ? [3 * quarter - 2, 3 * quarter - 1, 3 * quarter]
      : [month]
    return promos.filter((p) => {
      const s = new Date(p.start_date)
      const e = new Date(p.end_date)
      if (s.getFullYear() !== year && e.getFullYear() !== year) return false
      // Promo overlaps if its range intersects any of the displayed months
      return months.some((m) => {
        const monthStart = new Date(year, m - 1, 1)
        const monthEnd = new Date(year, m, 0)
        return s <= monthEnd && e >= monthStart
      })
    })
  }, [promos, view, year, quarter, month])

  const totalTarget = displayed.reduce((s, p) => s + Number(p.target_revenue || 0), 0)

  async function handleDelete(p) {
    if (!confirm(`Delete promo "${p.name}"?`)) return
    await deleteRow('promos', p.id, profile)
  }

  const months = view === 'quarter'
    ? [3 * quarter - 2, 3 * quarter - 1, 3 * quarter]
    : [month]

  return (
    <div className="space-y-4">
      {/* CONTROLS */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-md p-0.5">
            <ViewBtn active={view === 'quarter'} onClick={() => setView('quarter')}>Quarter</ViewBtn>
            <ViewBtn active={view === 'month'}   onClick={() => setView('month')}  >Month</ViewBtn>
            <ViewBtn active={view === 'list'}    onClick={() => setView('list')}   >All</ViewBtn>
          </div>
          {view === 'quarter' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setQuarter(Math.max(1, quarter - 1))} className="btn btn-ghost !px-2">
                <ChevronLeft size={14} />
              </button>
              <div className="font-semibold px-2 min-w-[80px] text-center">Q{quarter} {year}</div>
              <button onClick={() => setQuarter(Math.min(4, quarter + 1))} className="btn btn-ghost !px-2">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          {view === 'month' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (month === 1) { setMonth(12); setYear(year - 1) }
                  else setMonth(month - 1)
                }}
                className="btn btn-ghost !px-2"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="font-semibold px-2 min-w-[120px] text-center">
                {monthName(month)} {year}
              </div>
              <button
                onClick={() => {
                  if (month === 12) { setMonth(1); setYear(year + 1) }
                  else setMonth(month + 1)
                }}
                className="btn btn-ghost !px-2"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500">Target Revenue</div>
              <div className="font-display text-xl font-semibold">{fmtCompactCurrency(totalTarget)}</div>
            </div>
            {isManager && (
              <button onClick={() => setShowAdd(true)} className="btn btn-primary">
                <Plus size={14} /> New promo
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* CALENDAR VIEW */}
      {view !== 'list' && (
        <Card title="Calendar" subtitle="Each row is a month. Blue bars are promos; amber dots are tentpoles.">
          <div className="space-y-3">
            {months.map((m) => (
              <MonthRow
                key={m}
                year={year}
                month={m}
                promos={displayed}
                onPromoClick={(p) => setEditing(p)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* PROMO CARDS (detail) */}
      <div className="space-y-3">
        {displayed.length === 0 ? (
          <Card>
            <EmptyState
              icon={Calendar}
              title="No promos in this view"
              description="Try switching views or create a new promo."
            />
          </Card>
        ) : (
          displayed.map((p) => (
            <PromoCard
              key={p.id}
              promo={p}
              initiative={initiatives.find((i) => i.id === p.linked_initiative_id)}
              canEdit={isManager}
              onEdit={() => setEditing(p)}
              onDelete={() => handleDelete(p)}
            />
          ))
        )}
      </div>

      {showAdd && <PromoModal onClose={() => setShowAdd(false)} profile={profile} initiatives={initiatives} />}
      {editing && <PromoModal onClose={() => setEditing(null)} profile={profile} initiatives={initiatives} promo={editing} />}
    </div>
  )
}

function ViewBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'px-3 py-1 rounded text-sm font-medium',
        active ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'
      )}
    >
      {children}
    </button>
  )
}

// --- month row with promos as horizontal bars ------------------------------
function MonthRow({ year, month, promos, onPromoClick }) {
  const days = new Date(year, month, 0).getDate()
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  // Stack promos into rows (lanes) so they don't overlap
  const overlapping = promos
    .filter((p) => {
      const s = new Date(p.start_date), e = new Date(p.end_date)
      return s <= monthEnd && e >= monthStart
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))

  const lanes = []
  overlapping.forEach((p) => {
    const s = new Date(p.start_date), e = new Date(p.end_date)
    let placed = false
    for (const lane of lanes) {
      if (lane[lane.length - 1].endDate < s) {
        lane.push({ promo: p, startDate: s, endDate: e })
        placed = true
        break
      }
    }
    if (!placed) lanes.push([{ promo: p, startDate: s, endDate: e }])
  })

  const tentpoles = TENTPOLES.filter((t) => {
    const d = new Date(t.date)
    return d >= monthStart && d <= monthEnd
  })

  return (
    <div className="border border-slate-200 rounded-md p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="font-display font-semibold">{monthName(month)} {year}</div>
        <div className="text-xs text-slate-500">{overlapping.length} promo{overlapping.length === 1 ? '' : 's'}</div>
      </div>
      <div className="relative" style={{ minHeight: `${Math.max(lanes.length, 1) * 24 + 24}px` }}>
        {/* Day ticks */}
        <div className="absolute inset-x-0 top-0 h-full flex">
          {Array.from({ length: days }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-slate-100 last:border-r-0" />
          ))}
        </div>
        {/* Promo bars */}
        {lanes.map((lane, laneIdx) => (
          <div key={laneIdx} className="relative h-5 mb-1">
            {lane.map(({ promo, startDate, endDate }) => {
              const startDay = Math.max(1, startDate.getMonth() === month - 1 ? startDate.getDate() : 1)
              const endDay = Math.min(days, endDate.getMonth() === month - 1 ? endDate.getDate() : days)
              const left = ((startDay - 1) / days) * 100
              const width = ((endDay - startDay + 1) / days) * 100
              return (
                <button
                  key={promo.id}
                  onClick={() => onPromoClick(promo)}
                  className={classNames(
                    'absolute top-0 h-5 rounded px-1.5 text-[11px] font-medium text-white flex items-center overflow-hidden whitespace-nowrap hover:brightness-110 transition',
                    statusBarColor(promo.status)
                  )}
                  style={{ left: `${left}%`, width: `${Math.max(width, 3)}%` }}
                  title={`${promo.name} · ${fmtDate(promo.start_date)} – ${fmtDate(promo.end_date)}`}
                >
                  {promo.name}
                </button>
              )
            })}
          </div>
        ))}
        {/* Tentpoles */}
        {tentpoles.map((t) => {
          const d = new Date(t.date)
          const left = ((d.getDate() - 1) / days) * 100
          return (
            <div
              key={t.date}
              className="absolute bottom-0 flex flex-col items-center -translate-x-1/2"
              style={{ left: `${left}%` }}
              title={t.label}
            >
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <div className="text-[10px] text-amber-700 whitespace-nowrap mt-0.5">{t.label}</div>
            </div>
          )
        })}
      </div>
      {/* Day legend */}
      <div className="flex text-[10px] text-slate-400 mt-1">
        {[1, 5, 10, 15, 20, 25, days].map((d, i) => (
          <div
            key={i}
            className="absolute"
            style={{ left: `calc(${((d - 1) / days) * 100}% + 12px)` }}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  )
}

function statusBarColor(status) {
  return {
    planning:  'bg-slate-500',
    approved:  'bg-sky-600',
    active:    'bg-emerald-600',
    complete:  'bg-violet-600',
    cancelled: 'bg-rose-500',
  }[status] || 'bg-slate-500'
}

function statusTagColor(s) {
  return { planning: 'slate', approved: 'blue', active: 'green', complete: 'violet', cancelled: 'red' }[s] || 'slate'
}

// --- detail card -----------------------------------------------------------
function PromoCard({ promo, initiative, canEdit, onEdit, onDelete }) {
  const daysUntil = Math.ceil((new Date(promo.start_date) - new Date()) / (1000 * 60 * 60 * 24))
  const leadWarning = daysUntil > 0 && daysUntil < 60 && promo.status === 'planning'
  const materials = promo.materials_needed || {}

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg font-semibold">{promo.name}</h3>
            <Tag color={statusTagColor(promo.status)}>{promo.status}</Tag>
            {leadWarning && (
              <Tag color="red">
                <AlertCircle size={12} className="mr-0.5" />
                {daysUntil}d to go — planning risk
              </Tag>
            )}
          </div>
          <div className="text-sm text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {fmtDate(promo.start_date)} – {fmtDate(promo.end_date)}
            </span>
            <span>Owner: <span className="text-slate-700 font-medium">{promo.owner_name || '—'}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-slate-500">Target Revenue</div>
            <div className="font-display text-xl font-semibold">{fmtCompactCurrency(promo.target_revenue)}</div>
          </div>
          {canEdit && (
            <>
              <button onClick={onEdit} className="btn btn-ghost !px-2"><Edit3 size={13} /></button>
              <button onClick={onDelete} className="btn btn-ghost !px-2 text-rose-600"><Trash2 size={13} /></button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="section-title">Channels</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {(promo.channels || []).map((c) => <Tag key={c} color="blue">{c}</Tag>)}
          </div>
        </div>
        <div>
          <div className="section-title">Regions</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {(promo.regions || []).map((r) => <Tag key={r} color="slate">{r}</Tag>)}
          </div>
        </div>
        <div>
          <div className="section-title">Pricing</div>
          <div className="text-slate-700 mt-1">{promo.pricing_mechanics || '—'}</div>
        </div>
        <div>
          <div className="section-title flex items-center gap-1">
            <Package size={12} /> Materials
          </div>
          <div className="text-slate-700 mt-1 space-y-0.5">
            {Object.keys(materials).length === 0 ? '—' :
              Object.entries(materials).map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="font-mono font-semibold">{v}</span> {k.replace(/_/g, ' ')}
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {(promo.distributor_requirements || initiative) && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-sm">
          {promo.distributor_requirements && (
            <div>
              <span className="section-title mr-2">Distributor</span>
              <span className="text-slate-700">{promo.distributor_requirements}</span>
            </div>
          )}
          {initiative && (
            <div className="flex items-center gap-1.5 text-slate-600 text-xs">
              <Link2 size={12} /> Linked to initiative:{' '}
              <span className="font-medium text-slate-900">{initiative.name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- promo modal -----------------------------------------------------------
function PromoModal({ onClose, profile, initiatives, promo }) {
  const isEdit = !!promo
  const [form, setForm] = useState({
    name: promo?.name || '',
    start_date: promo?.start_date || '',
    end_date: promo?.end_date || '',
    channels: promo?.channels || [],
    regions: promo?.regions || [],
    target_revenue: promo?.target_revenue ?? '',
    pricing_mechanics: promo?.pricing_mechanics || '',
    materials_text: promo?.materials_needed
      ? Object.entries(promo.materials_needed).map(([k, v]) => `${k}: ${v}`).join('\n')
      : '',
    distributor_requirements: promo?.distributor_requirements || '',
    status: promo?.status || 'planning',
    linked_initiative_id: promo?.linked_initiative_id || '',
  })
  const [saving, setSaving] = useState(false)

  function parseMaterials(text) {
    const out = {}
    for (const line of text.split('\n')) {
      const [k, v] = line.split(':').map((x) => x.trim())
      if (k && v) out[k.replace(/\s+/g, '_')] = /^\d+$/.test(v) ? Number(v) : v
    }
    return out
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const values = {
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        channels: form.channels,
        regions: form.regions,
        target_revenue: form.target_revenue === '' ? null : Number(form.target_revenue),
        pricing_mechanics: form.pricing_mechanics || null,
        materials_needed: parseMaterials(form.materials_text),
        distributor_requirements: form.distributor_requirements || null,
        status: form.status,
        owner: profile.id,
        owner_name: profile.full_name,
        linked_initiative_id: form.linked_initiative_id || null,
      }
      if (isEdit) await updateRow('promos', promo.id, values, profile)
      else        await insertRow('promos', values, profile)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function toggle(arr, value) {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit promo' : 'New promo'} maxWidth="max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Name">
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" required className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="End date">
            <input type="date" required className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
        </div>
        <Field label="Channels">
          <div className="flex flex-wrap gap-1.5 mt-1">
            {CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, channels: toggle(form.channels, c) })}
                className={classNames(
                  'px-2 py-1 rounded text-xs font-medium border',
                  form.channels.includes(c)
                    ? 'bg-navy-900 text-white border-navy-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Regions">
          <div className="flex flex-wrap gap-1.5 mt-1">
            {REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm({ ...form, regions: toggle(form.regions, r) })}
                className={classNames(
                  'px-2 py-1 rounded text-xs font-medium border',
                  form.regions.includes(r)
                    ? 'bg-navy-900 text-white border-navy-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target revenue ($)">
            <input type="number" className="input" value={form.target_revenue} onChange={(e) => setForm({ ...form, target_revenue: e.target.value })} />
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="planning">Planning</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="complete">Complete</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>
        <Field label="Pricing mechanics">
          <input className="input" value={form.pricing_mechanics} onChange={(e) => setForm({ ...form, pricing_mechanics: e.target.value })} placeholder='2 for $10 suggested SRP' />
        </Field>
        <Field label="Materials (one per line: key: value)">
          <textarea rows="3" className="input font-mono text-xs" value={form.materials_text} onChange={(e) => setForm({ ...form, materials_text: e.target.value })} placeholder="case_stackers: 100&#10;acrylics: 200" />
        </Field>
        <Field label="Distributor requirements">
          <textarea rows="2" className="input" value={form.distributor_requirements} onChange={(e) => setForm({ ...form, distributor_requirements: e.target.value })} />
        </Field>
        <Field label="Link to initiative (optional)">
          <select className="input" value={form.linked_initiative_id} onChange={(e) => setForm({ ...form, linked_initiative_id: e.target.value })}>
            <option value="">—</option>
            {initiatives.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
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

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  )
}
