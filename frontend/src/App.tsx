import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/auth'
import { Layout } from './components/layout/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AgentsPage } from './pages/AgentsPage'
import { AgentDetailPage } from './pages/AgentDetailPage'
import { PoliciesPage } from './pages/PoliciesPage'
import { AuditPage } from './pages/AuditPage'
import { RiskEventsPage } from './pages/RiskEventsPage'
import { SystemHealthPage } from './pages/SystemHealthPage'
import { SettingsPage } from './pages/SettingsPage'
import { LiveLogViewer } from './pages/LiveLogViewer'
import { AnomalyDashboardPage } from './pages/AnomalyDashboardPage'
import { AgentConsolePage } from './pages/AgentConsolePage'
import { AgentComparisonPage } from './pages/AgentComparisonPage'
import { LiveThreatGraphPage } from './pages/LiveThreatGraphPage'
import { ScenarioPage } from './pages/ScenarioPage'
import { DemoDirectorPage } from './pages/DemoDirectorPage'
import { IncidentsPage } from './pages/IncidentsPage'
import { RiskTimelinePage } from './pages/RiskTimelinePage'
import { ForensicTimelinePage } from './pages/ForensicTimelinePage'

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
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="agents/:id" element={<AgentDetailPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="risk-events" element={<RiskEventsPage />} />
        <Route path="system-health" element={<SystemHealthPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="live" element={<LiveLogViewer />} />
        <Route path="anomaly" element={<AnomalyDashboardPage />} />
        <Route path="console" element={<AgentConsolePage />} />
        <Route path="compare" element={<AgentComparisonPage />} />
        <Route path="threat-graph" element={<LiveThreatGraphPage />} />
        <Route path="scenarios" element={<ScenarioPage />} />
        <Route path="demo-director" element={<DemoDirectorPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="risk-timeline" element={<RiskTimelinePage />} />
        <Route path="forensic" element={<ForensicTimelinePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
