import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, LineChart, AlertTriangle, Lightbulb, CalendarDays,
  Calculator, Building2, LogOut, Bell, ChevronDown, Target,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useState } from 'react'
import { classNames } from '../../lib/format'
import { isSupabaseConfigured } from '../../lib/supabase'

const NAV = [
  { to: '/',              label: 'Dashboard',         icon: LayoutDashboard, roles: ['manager', 'rep', 'viewer'] },
  { to: '/plan',          label: 'Plan & Forecast',   icon: LineChart,       roles: ['manager', 'rep', 'viewer'] },
  { to: '/risks',         label: 'Risks & Opps',      icon: AlertTriangle,   roles: ['manager', 'rep', 'viewer'] },
  { to: '/initiatives',   label: 'Initiatives',       icon: Lightbulb,       roles: ['manager', 'rep', 'viewer'] },
  { to: '/promos',        label: 'Promo Calendar',    icon: CalendarDays,    roles: ['manager', 'rep', 'viewer'] },
  { to: '/miss',          label: 'Miss Calculator',   icon: Calculator,      roles: ['manager', 'viewer'] },
  { to: '/distributors',  label: 'Distributors',      icon: Building2,       roles: ['manager', 'rep', 'viewer'] },
  { to: '/targets',       label: 'Target Setting',    icon: Target,          roles: ['manager'] },
]

export default function Shell({ children }) {
  const { profile, signOut } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  if (!profile) return null

  const visibleNav = NAV.filter((n) => n.roles.includes(profile.role))

  const initials = profile.full_name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-60 flex-col bg-navy-950 text-white">
        <div className="px-5 py-5 border-b border-navy-800">
          <div className="font-display text-xl font-semibold tracking-tight">Mitra-9</div>
          <div className="text-xs text-navy-300 mt-0.5">Sales Planning & Ops</div>
        </div>
        <nav className="flex-1 py-4">
          {visibleNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  classNames(
                    'flex items-center gap-3 px-5 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-navy-800 text-white border-l-2 border-accent-amber'
                      : 'text-navy-200 hover:text-white hover:bg-navy-900 border-l-2 border-transparent'
                  )
                }
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="px-5 py-3 border-t border-navy-800 text-xs text-navy-300">
          <div>FY2026 · April</div>
          <div className="mt-1">
            {isSupabaseConfigured ? (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Demo mode
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-navy-900 text-white border-b border-navy-950">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="md:hidden font-display text-lg font-semibold">Mitra-9</div>
            <div className="hidden md:block">
              <div className="font-display text-lg font-semibold leading-tight">
                {pageTitle(location.pathname)}
              </div>
              <div className="text-xs text-navy-300">{pageSubtitle(location.pathname)}</div>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-navy-200 hover:text-white" aria-label="Notifications">
                <Bell size={18} />
              </button>
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="h-8 w-8 rounded-full bg-navy-700 flex items-center justify-center text-xs font-semibold">
                    {initials}
                  </span>
                  <div className="hidden sm:block text-left">
                    <div className="leading-tight">{profile.full_name}</div>
                    <div className="text-[10px] text-navy-300 uppercase tracking-wider">
                      {profile.role}
                      {profile.sales_channel && ` · ${profile.sales_channel}`}
                    </div>
                  </div>
                  <ChevronDown size={14} className="text-navy-300" />
                </button>
                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-white text-navy-900 rounded-md shadow-lg border border-slate-200 py-1 z-30"
                    onMouseLeave={() => setUserMenuOpen(false)}
                  >
                    <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
                      {profile.email}
                    </div>
                    <button
                      onClick={async () => { await signOut(); navigate('/login') }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-[1400px] mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function pageTitle(path) {
  const map = {
    '/': 'Dashboard',
    '/plan': 'Plan & Forecast',
    '/risks': 'Risks & Opportunities',
    '/initiatives': 'Initiatives',
    '/promos': 'Promotional Calendar',
    '/miss': 'Revenue Miss Calculator',
    '/distributors': 'Distributor Scorecard',
    '/targets': 'Target Setting',
  }
  return map[path] || 'Mitra-9'
}

function pageSubtitle(path) {
  const map = {
    '/': 'MTD KPIs, forecast status, and top risks/opportunities',
    '/plan': 'Annual plan, monthly re-forecast, and plan-to-actuals bridge',
    '/risks': 'Base vs incremental tracking with ownership and next steps',
    '/initiatives': 'Whiteboard scoring and stage management',
    '/promos': 'Plan, sequence, and link promos to forecast impact',
    '/miss': 'True-cost modeling for delayed and unshipped orders',
    '/distributors': 'Partner-level performance vs target',
    '/targets': 'Set distributor and rep revenue plans for the fiscal year',
  }
  return map[path] || ''
}
