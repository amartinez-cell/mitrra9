import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Shell from './components/layout/Shell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PlanForecastPage from './pages/PlanForecastPage'
import RiskOppsPage from './pages/RiskOppsPage'
import InitiativesPage from './pages/InitiativesPage'
import PromosPage from './pages/PromosPage'
import MissCalculatorPage from './pages/MissCalculatorPage'
import DistributorsPage from './pages/DistributorsPage'
import TargetsPage from './pages/targets/TargetsPage'

function RequireAuth({ children }) {
  const { profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    )
  }
  if (!profile) return <Navigate to="/login" replace />
  return <Shell>{children}</Shell>
}

function RequireRole({ roles, children }) {
  const { profile } = useAuth()
  if (!roles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/"             element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/plan"         element={<RequireAuth><PlanForecastPage /></RequireAuth>} />
        <Route path="/risks"        element={<RequireAuth><RiskOppsPage /></RequireAuth>} />
        <Route path="/initiatives"  element={<RequireAuth><InitiativesPage /></RequireAuth>} />
        <Route path="/promos"       element={<RequireAuth><PromosPage /></RequireAuth>} />
        <Route
          path="/miss"
          element={
            <RequireAuth>
              <RequireRole roles={['manager', 'viewer']}>
                <MissCalculatorPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route path="/distributors" element={<RequireAuth><DistributorsPage /></RequireAuth>} />
        <Route
          path="/targets"
          element={
            <RequireAuth>
              <RequireRole roles={['manager']}>
                <TargetsPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
