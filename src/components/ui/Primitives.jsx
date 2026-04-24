import { X } from 'lucide-react'
import { classNames, fmtCompactCurrency, fmtPct, ragColor } from '../../lib/format'

export function Card({ title, subtitle, right, children, className }) {
  return (
    <section className={classNames('card p-5', className)}>
      {(title || right) && (
        <header className="flex items-start justify-between mb-4 gap-4">
          <div>
            {title && <h2 className="text-lg font-display font-semibold leading-tight">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatTile({ label, value, delta, deltaLabel, rag, footnote }) {
  return (
    <div className="card p-5">
      <div className="section-title">{label}</div>
      <div className="flex items-baseline gap-2 mt-2">
        <div className="kpi-value">{value}</div>
        {delta != null && (
          <span
            className={classNames(
              'text-sm font-semibold',
              delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-500'
            )}
          >
            {delta > 0 ? '+' : ''}
            {typeof delta === 'number' && Math.abs(delta) < 1
              ? fmtPct(delta)
              : fmtCompactCurrency(delta)}
            {deltaLabel && <span className="ml-1 text-slate-500 font-normal">{deltaLabel}</span>}
          </span>
        )}
      </div>
      {rag && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={classNames(
              'h-2 w-2 rounded-full',
              rag === 'green' ? 'bg-emerald-500' :
              rag === 'amber' ? 'bg-amber-500' :
              rag === 'red'   ? 'bg-rose-500'   : 'bg-slate-400'
            )}
          />
          <span className="text-xs text-slate-500 capitalize">{rag}</span>
        </div>
      )}
      {footnote && <div className="mt-2 text-xs text-slate-500">{footnote}</div>}
    </div>
  )
}

export function Tag({ children, color = 'slate', className }) {
  return (
    <span className={classNames('tag', `tag-${color}`, className)}>{children}</span>
  )
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-navy-950/50 backdrop-blur-sm overflow-y-auto">
      <div className={classNames('w-full bg-white rounded-xl shadow-xl my-8 overflow-hidden', maxWidth)}>
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="btn btn-ghost p-1 -mr-1" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && <Icon size={32} className="mx-auto text-slate-400 mb-3" />}
      <h3 className="font-semibold text-navy-800">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function RagDot({ rag }) {
  return (
    <span
      className={classNames(
        'inline-block h-2 w-2 rounded-full',
        rag === 'green' ? 'bg-emerald-500' :
        rag === 'amber' ? 'bg-amber-500' :
        rag === 'red'   ? 'bg-rose-500'   : 'bg-slate-400'
      )}
    />
  )
}

export { ragColor }
