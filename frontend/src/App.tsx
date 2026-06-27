import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/auth'
import { Layout } from './components/layout/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AgentWorkspacePage } from './pages/AgentWorkspacePage'
import { IncidentWorkspacePage } from './pages/IncidentWorkspacePage'
import { DeceptionCenterPage } from './pages/DeceptionCenterPage'
import { SimulationCenterPage } from './pages/SimulationCenterPage'
import { DemoDirectorPage } from './pages/DemoDirectorPage'
import { PoliciesPage } from './pages/PoliciesPage'
import { OperatorSecurityPage } from './pages/OperatorSecurityPage'
import { AuditPage } from './pages/AuditPage'
import { SettingsPage } from './pages/SettingsPage'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { PolicyDSLPage } from './pages/PolicyDSLPage'
import type { Role } from '@/types'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Loading AgentGuard...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RoleRoute({ children, roles }: { children: React.ReactNode; roles: Role[] }) {
  const user = useAuthStore((s) => s.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'admin' && !roles.includes(user.role)) {
    return <Navigate to="/command-center" replace />
  }

  return <>{children}</>
}

// Redirect helpers for console/replay parameter mapping
function RedirectConsole() {
  const [params] = useSearchParams()
  const agentId = params.get('agentId') || params.get('id') || ''
  return <Navigate to={agentId ? `/fleet?id=${agentId}&tab=console` : '/fleet?tab=console'} replace />
}

function RedirectReplay() {
  const [params] = useSearchParams()
  const sessionId = params.get('session') || params.get('id') || ''
  return <Navigate to={sessionId ? `/investigation?id=${sessionId}&tab=replay` : '/investigation?tab=replay'} replace />
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/command-center" replace />} />
        <Route path="command-center" element={<DashboardPage />} />
        
        {/* Fleet Workspace */}
        <Route path="fleet" element={<AgentWorkspacePage />} />
        
        {/* Investigation Workspace */}
        <Route path="investigation" element={<IncidentWorkspacePage />} />
        
        {/* Deception Center */}
        <Route path="deception-center" element={<DeceptionCenterPage />} />
        
        {/* Governance */}
        <Route path="policies" element={<RoleRoute roles={['operator', 'engineer', 'admin']}><PoliciesPage /></RoleRoute>} />
        <Route path="operator-security" element={<RoleRoute roles={['analyst', 'operator', 'engineer', 'admin']}><OperatorSecurityPage /></RoleRoute>} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="policy-dsl" element={<PolicyDSLPage />} />

        {/* Simulation */}
        <Route path="simulation-center" element={<RoleRoute roles={['demo', 'analyst', 'operator', 'engineer', 'admin']}><SimulationCenterPage /></RoleRoute>} />
        <Route path="demo-director" element={<RoleRoute roles={['demo', 'admin']}><DemoDirectorPage /></RoleRoute>} />

        {/* Settings & Architecture */}
        <Route path="settings" element={<RoleRoute roles={['admin']}><SettingsPage /></RoleRoute>} />
        <Route path="architecture" element={<ArchitecturePage />} />

        {/* Legacy Redirect Aliases for Backward Compatibility */}
        <Route path="dashboard" element={<Navigate to="/command-center" replace />} />
        <Route path="agents" element={<Navigate to="/fleet" replace />} />
        <Route path="incidents" element={<Navigate to="/investigation" replace />} />
        <Route path="honeytools" element={<Navigate to="/deception-center" replace />} />
        <Route path="console" element={<RedirectConsole />} />
        <Route path="replay" element={<RedirectReplay />} />
        <Route path="compare" element={<Navigate to="/fleet" replace />} />
        <Route path="risk-events" element={<Navigate to="/investigation" replace />} />
        <Route path="risk-timeline" element={<Navigate to="/investigation" replace />} />
        <Route path="forensic" element={<Navigate to="/investigation" replace />} />
        <Route path="honeytool-center" element={<Navigate to="/deception-center" replace />} />
        <Route path="scenarios" element={<Navigate to="/simulation-center" replace />} />
        <Route path="langchain" element={<Navigate to="/settings" replace />} />
        <Route path="behavior-profile/:id" element={<RedirectConsole />} />
        <Route path="behavior-profile" element={<Navigate to="/fleet" replace />} />
        <Route path="risk-breakdown/:id" element={<RedirectConsole />} />
        <Route path="risk-breakdown" element={<Navigate to="/fleet" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/command-center" replace />} />
    </Routes>
  )
}
