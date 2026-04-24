import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, KeyRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { MOCK_USERS } from '../data/mockUsers'
import { classNames } from '../lib/format'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [demoUserId, setDemoUserId] = useState(MOCK_USERS[0].id)
  const [err, setErr] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    try {
      await signIn({ email, password, demoUserId })
      navigate('/')
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_30%,_rgba(217,119,6,0.3),_transparent_50%),radial-gradient(circle_at_80%_70%,_rgba(13,148,136,0.25),_transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <div className="font-display text-3xl font-semibold">Mitra-9</div>
            <div className="text-navy-300 text-sm mt-1">Sales Planning & Operations</div>
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-4xl font-semibold leading-tight">
              One source of truth for plan, forecast, and execution.
            </h1>
            <p className="text-navy-200 mt-4 leading-relaxed">
              Bottom-up rep forecasting, plan-to-actuals bridge, risks and opportunities,
              promo calendar, and initiative scoring — connected.
            </p>
          </div>
          <div className="text-xs text-navy-400">
            FY2026 · Internal use only
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">
              {isSupabaseConfigured
                ? 'Use your Mitra-9 account credentials.'
                : 'Demo mode — select a user to sign in as.'}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {isSupabaseConfigured ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sign in as</label>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {MOCK_USERS.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => setDemoUserId(u.id)}
                      className={classNames(
                        'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md border text-left text-sm transition-colors',
                        u.id === demoUserId
                          ? 'bg-navy-50 border-navy-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      <div>
                        <div className="font-semibold">{u.full_name}</div>
                        <div className="text-xs text-slate-500">
                          {u.sales_channel || '—'} {u.sales_region && `· ${u.sales_region}`}
                        </div>
                      </div>
                      <span className={classNames(
                        'tag',
                        u.role === 'manager' ? 'tag-violet' :
                        u.role === 'rep'     ? 'tag-blue'   : 'tag-slate'
                      )}>
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {err && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                {err}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center py-2.5">
              {isSupabaseConfigured ? <KeyRound size={16} /> : <LogIn size={16} />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {!isSupabaseConfigured && (
            <div className="mt-6 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-3">
              <span className="font-semibold text-slate-700">Demo mode:</span>{' '}
              No Supabase credentials detected. All data is in-memory. To connect a
              real backend, set <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> in{' '}
              <code className="font-mono text-xs">.env.local</code>.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
