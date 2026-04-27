import { useMemo } from 'react'
import {
  TrendingUp, Clock, AlertTriangle, Sparkles, CalendarDays,
  CheckCircle2, CircleDashed, Users,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from 'recharts'
import { useAuth } from '../hooks/useAuth'
import { useTable } from '../hooks/useTable'
import { useAsync } from '../hooks/useAsync'
import {
  fetchByChannel, fetchDailyPacing, fetchTrend,
} from '../lib/bigqueryApi'
import { Card, StatTile, Tag, RagDot } from '../components/ui/Primitives'
import {
  fmtCompactCurrency, fmtPct, fmtRelative, ragColor, classNames, monthName,
} from '../lib/format'

const FY = 2026
const MONTH = 4

export default function DashboardPage() {
  const { profile, isRep } = useAuth()

  // Read-side (BigQuery stub) -----------------------------------------------
  const { data: byChannel }  = useAsync(() => fetchByChannel(FY, MONTH), [])
  const { data: pacing }     = useAsync(() => fetchDailyPacing(FY, MONTH), [])
  const { data: trend }      = useAsync(() => fetchTrend(FY, MONTH, 6), [])

  // Write-side (Supabase / mockStore) ---------------------------------------
  const { rows: plan }       = useTable('annual_plan')
  const { rows: forecasts }    = useTable('forecast_entries')
  const { rows: forecastCells } = useTable('forecast_cells')
  const { rows: distributors }  = useTable('distributors')
  const { rows: submissions }   = useTable('forecast_submissions')
  const { rows: roItems }    = useTable('ro_items')
  const { rows: promos }     = useTable('promos')
  const { rows: profiles }   = useTable('profiles')
  const { rows: activity }   = useTable('activity_log', { order: { column: 'created_at', ascending: false } })

  const planByChannel = useMemo(() => {
    const m = {}
    for (const p of plan) {
      if (p.fiscal_year === FY && p.month === MONTH) {
        m[p.sales_channel] = (m[p.sales_channel] || 0) + Number(p.planned_revenue || 0)
      }
    }
    return m
  }, [plan])

  const totalPlan = useMemo(
    () => Object.values(planByChannel).reduce((a, b) => a + b, 0),
    [planByChannel]
  )

  const totalActualMTD = pacing?.mtd_revenue || 0
  const currentDay     = pacing?.current_day || 1
  const daysInMonth    = pacing?.days_in_month || 30

  const pacePct      = totalPlan ? totalActualMTD / ((totalPlan / daysInMonth) * currentDay) : null
  const pctToPlan    = totalPlan ? totalActualMTD / totalPlan : null
  const daysLeft     = daysInMonth - currentDay
  const needed       = totalPlan - totalActualMTD
  const requiredADR  = daysLeft > 0 ? needed / daysLeft : 0
  const currentADR   = currentDay ? totalActualMTD / currentDay : 0

  const channelRows = useMemo(() => {
    if (!byChannel) return []
    return byChannel.rows.map((r) => {
      const p = planByChannel[r.sales_channel] || 0
      // Prorate plan to the current day for a pacing-based RAG
      const proratedPlan = p * (currentDay / daysInMonth)
      const ratio = proratedPlan ? r.revenue / proratedPlan : null
      return {
        channel: r.sales_channel,
        actual: r.revenue,
        plan: p,
        pctPlan: p ? r.revenue / p : null,
        pacing: ratio,
        rag: ragColor(ratio),
      }
    }).sort((a, b) => (b.plan || 0) - (a.plan || 0))
  }, [byChannel, planByChannel, currentDay, daysInMonth])

  // Filter by rep's channel if they're a rep
  const repScope = (row) => !isRep || row.sales_channel === profile.sales_channel
  const repChannelRows = isRep
    ? channelRows.filter((c) => c.channel === profile.sales_channel)
    : channelRows

  // Forecast submission tracker — a rep is considered to have submitted their
  // grid for the month if they own ≥ 1 distributor and have at least one
  // forecast_cell touched for that month, or have an explicit submission row.
  const submissionByRep = useMemo(() => {
    const reps = profiles.filter((p) => p.role === 'rep')
    // Index distributors by owner_rep_id
    const distsByOwner = {}
    for (const d of distributors) {
      if (!d.owner_rep_id) continue
      if (!distsByOwner[d.owner_rep_id]) distsByOwner[d.owner_rep_id] = []
      distsByOwner[d.owner_rep_id].push(d.id)
    }
    return reps.map((r) => {
      const ownedIds = distsByOwner[r.id] || []
      // Forecast cells the rep is responsible for this month
      const cells = forecastCells.filter(
        (c) => c.fiscal_year === FY && c.month === MONTH && ownedIds.includes(c.distributor_id)
      )
      const sub = submissions.find(
        (s) => s.submitted_by === r.id && s.fiscal_year === FY && (s.scope_month === MONTH || s.scope === 'remaining_fy')
      )
      // A rep with no distributors at all is not in scope (they may be inbound team etc.)
      const inScope = ownedIds.length > 0
      const hasCells = cells.length > 0
      // For mock-mode demo, treat existence of seed cells as "submitted" baseline
      // so the dashboard isn't all-red on first load.
      const status = !inScope ? 'n/a'
        : sub?.status === 'approved' ? 'approved'
        : sub?.status === 'submitted' ? 'submitted'
        : sub?.status === 'draft' ? 'draft'
        : hasCells ? 'submitted'
        : 'missing'
      const forecastTotal = cells.reduce((s, c) => s + Number(c.forecasted_revenue || 0), 0)
      return {
        ...r,
        count: cells.length,
        forecastTotal,
        status,
      }
    }).filter((r) => r.status !== 'n/a')
  }, [profiles, forecastCells, distributors, submissions])

  const missingCount   = submissionByRep.filter((r) => r.status === 'missing').length
  const draftCount     = submissionByRep.filter((r) => r.status === 'draft').length
  const submittedCount = submissionByRep.filter((r) => r.status === 'submitted' || r.status === 'approved').length

  // Top R&O by expected value
  const topRisks = useMemo(
    () => roItems
      .filter((r) => r.item_type === 'risk' && r.status !== 'closed_lost' && r.status !== 'closed_won')
      .filter((r) => !isRep || r.sales_channel === profile.sales_channel || !r.sales_channel)
      .sort((a, b) => Math.abs(Number(b.expected_value || 0)) - Math.abs(Number(a.expected_value || 0)))
      .slice(0, 3),
    [roItems, isRep, profile]
  )
  const topOpps = useMemo(
    () => roItems
      .filter((r) => r.item_type === 'opportunity' && r.status !== 'closed_lost' && r.status !== 'closed_won')
      .filter((r) => !isRep || r.sales_channel === profile.sales_channel || !r.sales_channel)
      .sort((a, b) => Number(b.expected_value || 0) - Number(a.expected_value || 0))
      .slice(0, 3),
    [roItems, isRep, profile]
  )

  // Upcoming promos (next 30 days)
  const today = new Date()
  const in30  = new Date(today)
  in30.setDate(today.getDate() + 30)
  const upcomingPromos = promos
    .filter((p) => {
      const s = new Date(p.start_date)
      return s >= today && s <= in30
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 4)

  return (
    <div className="space-y-6">
      {/* --- KPI ROW ---------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label={`MTD Revenue · ${monthName(MONTH)}`}
          value={fmtCompactCurrency(totalActualMTD)}
          footnote={`Through day ${currentDay} of ${daysInMonth}`}
        />
        <StatTile
          label="% to Monthly Plan"
          value={fmtPct(pctToPlan)}
          rag={ragColor(pacePct)}
          footnote={
            pacePct != null
              ? `Pacing ${pacePct >= 1 ? 'ahead' : 'behind'} plan by ${fmtPct(Math.abs(pacePct - 1))}`
              : null
          }
        />
        <StatTile
          label="Current Daily Average"
          value={fmtCompactCurrency(currentADR)}
          footnote={`vs. required ${fmtCompactCurrency(requiredADR)}`}
        />
        <StatTile
          label="Days Left · Gap to Plan"
          value={`${daysLeft}d`}
          footnote={`Need ${fmtCompactCurrency(Math.max(0, needed))} to hit plan`}
        />
      </div>

      {/* --- CHART ROW ------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Daily Pacing" subtitle={`${monthName(MONTH)} ${FY}`} className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={buildCumulativePacing(pacing, totalPlan)}>
                <defs>
                  <linearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#1c2d4a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1c2d4a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={54} />
                <Tooltip
                  formatter={(v, k) => [fmtCompactCurrency(v), k === 'cumulative' ? 'Actual (cum.)' : 'Plan (cum.)']}
                  labelFormatter={(l) => `Day ${l}`}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
                <Area type="monotone" dataKey="planCumulative" stroke="#94a3b8" strokeDasharray="4 4" fill="none" />
                <Area type="monotone" dataKey="cumulative" stroke="#1c2d4a" strokeWidth={2} fill="url(#pgrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="6-Month Revenue Trend">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend?.rows || []}>
                <XAxis
                  dataKey="month"
                  tickFormatter={(m) => monthName(m)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={54} />
                <Tooltip
                  formatter={(v) => fmtCompactCurrency(v)}
                  labelFormatter={(m) => `${monthName(m)} ${FY}`}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
                <Bar dataKey="total_revenue" radius={[3, 3, 0, 0]}>
                  {(trend?.rows || []).map((_, i, arr) => (
                    <Cell key={i} fill={i === arr.length - 1 ? '#1c2d4a' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* --- CHANNEL BREAKDOWN ---------------------------------------------- */}
      <Card
        title={isRep ? 'My Channel — MTD vs Plan' : 'Channel Breakdown — MTD vs Plan'}
        subtitle="RAG based on pacing to current day"
      >
        <table className="table-base">
          <thead>
            <tr>
              <th>Channel</th>
              <th className="text-right">MTD Actual</th>
              <th className="text-right">Monthly Plan</th>
              <th className="text-right">% to Plan</th>
              <th className="text-right">Pacing</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {repChannelRows.map((r) => (
              <tr key={r.channel}>
                <td className="font-medium">{r.channel}</td>
                <td className="text-right font-mono">{fmtCompactCurrency(r.actual)}</td>
                <td className="text-right font-mono text-slate-600">{fmtCompactCurrency(r.plan)}</td>
                <td className="text-right font-mono">{fmtPct(r.pctPlan)}</td>
                <td className="text-right font-mono">{fmtPct(r.pacing)}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    <RagDot rag={r.rag} />
                    <span className="text-xs capitalize text-slate-600">
                      {r.rag === 'green' ? 'On pace' : r.rag === 'amber' ? 'Watch' : 'Behind'}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* --- MANAGER ROW: submission tracker + activity -------------------- */}
      {!isRep && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card
            title="Forecast Submission Tracker"
            subtitle={`April — ${submittedCount} submitted · ${draftCount} draft · ${missingCount} not started`}
            className="lg:col-span-2"
          >
            <div className="space-y-1.5">
              {submissionByRep.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-3 py-2 rounded border border-slate-100 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    {r.status === 'approved' || r.status === 'submitted'
                      ? <CheckCircle2 size={16} className="text-emerald-600" />
                      : r.status === 'draft'
                      ? <Clock size={16} className="text-amber-600" />
                      : <CircleDashed size={16} className="text-rose-500" />}
                    <div>
                      <div className="text-sm font-medium">{r.full_name}</div>
                      <div className="text-xs text-slate-500">{r.sales_channel || '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono">{fmtCompactCurrency(r.forecastTotal)}</span>
                    <Tag color={
                      r.status === 'approved' ? 'green' :
                      r.status === 'submitted' ? 'blue' :
                      r.status === 'draft' ? 'amber' : 'red'
                    }>
                      {r.status === 'missing' ? 'not started' : r.status}
                    </Tag>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Recent Activity" subtitle="Live feed">
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {activity.slice(0, 8).map((a) => (
                <div key={a.id} className="text-sm">
                  <div>
                    <span className="font-semibold">{a.user_name}</span>{' '}
                    <span className="text-slate-600">
                      {verbFor(a.action)} {entityLabel(a.entity_type)}
                    </span>
                  </div>
                  {a.details?.customer && (
                    <div className="text-xs text-slate-500">
                      {a.details.customer}
                      {a.details.amount && ` · ${fmtCompactCurrency(a.details.amount)}`}
                    </div>
                  )}
                  {a.details?.name && (
                    <div className="text-xs text-slate-500">{a.details.name}</div>
                  )}
                  {a.details?.description && (
                    <div className="text-xs text-slate-500 line-clamp-1">{a.details.description}</div>
                  )}
                  <div className="text-[11px] text-slate-400 mt-0.5">{fmtRelative(a.created_at)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* --- R&O + PROMOS --------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Top Risks"
          right={<AlertTriangle size={16} className="text-rose-500" />}
        >
          {topRisks.length === 0 ? (
            <div className="text-sm text-slate-500">No open risks.</div>
          ) : (
            <ul className="space-y-2.5">
              {topRisks.map((r) => (
                <li key={r.id} className="pb-2.5 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium line-clamp-2">{r.description}</div>
                    <span className="font-mono text-sm text-rose-700 whitespace-nowrap">
                      {fmtCompactCurrency(r.expected_value)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <Tag color={r.classification === 'base' ? 'slate' : 'amber'}>
                      {r.classification}
                    </Tag>
                    <span>· {r.owner_name || '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title="Top Opportunities"
          right={<Sparkles size={16} className="text-emerald-600" />}
        >
          {topOpps.length === 0 ? (
            <div className="text-sm text-slate-500">No open opportunities.</div>
          ) : (
            <ul className="space-y-2.5">
              {topOpps.map((r) => (
                <li key={r.id} className="pb-2.5 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium line-clamp-2">{r.description}</div>
                    <span className="font-mono text-sm text-emerald-700 whitespace-nowrap">
                      +{fmtCompactCurrency(r.expected_value)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <Tag color={r.classification === 'base' ? 'slate' : 'amber'}>
                      {r.classification}
                    </Tag>
                    <span>· {r.owner_name || '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title="Upcoming Promos"
          subtitle="Next 30 days"
          right={<CalendarDays size={16} className="text-navy-600" />}
        >
          {upcomingPromos.length === 0 ? (
            <div className="text-sm text-slate-500">No promos in the next 30 days.</div>
          ) : (
            <ul className="space-y-2.5">
              {upcomingPromos.map((p) => (
                <li key={p.id} className="pb-2.5 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {fmtPromoDates(p.start_date, p.end_date)}
                    {p.target_revenue && ` · ${fmtCompactCurrency(p.target_revenue)}`}
                  </div>
                  <div className="mt-1">
                    <Tag color={statusColor(p.status)}>{p.status}</Tag>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

// --- helpers --------------------------------------------------------------
function buildCumulativePacing(pacing, totalPlan) {
  if (!pacing?.rows) return []
  const daysInMonth = pacing.days_in_month
  const currentDay  = pacing.current_day
  const planPerDay = totalPlan / daysInMonth
  let cum = 0
  return pacing.rows.map((r, i) => {
    const day = r.day
    const past = day <= currentDay
    cum = past ? cum + r.revenue : cum
    return {
      day,
      cumulative: past ? cum : null,
      planCumulative: planPerDay * day,
    }
  })
}

function verbFor(action) {
  return {
    created: 'created',
    updated: 'updated',
    submitted: 'submitted',
    approved: 'approved',
    deleted: 'deleted',
  }[action] || action
}

function entityLabel(t) {
  return {
    forecast: 'a forecast',
    forecast_entries: 'a forecast',
    ro_item: 'an R&O item',
    ro_items: 'an R&O item',
    initiative: 'an initiative',
    initiatives: 'an initiative',
    promo: 'a promo',
    promos: 'a promo',
    bridge_buckets: 'a bridge bucket',
    annual_plan: 'the annual plan',
  }[t] || t
}

function fmtPromoDates(start, end) {
  const s = new Date(start)
  const e = new Date(end)
  const sameMonth = s.getMonth() === e.getMonth()
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return sameMonth ? `${fmt(s)}–${e.getDate()}` : `${fmt(s)} – ${fmt(e)}`
}

function statusColor(s) {
  return {
    planning:  'slate',
    approved:  'blue',
    active:    'green',
    complete:  'violet',
    cancelled: 'red',
  }[s] || 'slate'
}
