import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Menu, Command, FlaskConical } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { NotificationCenter } from '@/components/NotificationCenter'
import { CommandPalette } from '@/components/CommandPalette'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { RoleBadge } from '@/components/RoleBadge'
import { HoneytoolIncidentBanner } from '@/components/HoneytoolIncidentBanner'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/auth'
import { getToken, api } from '@/services/api'
import { useWebSocket, subscribe } from '@/hooks/useWebSocket'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [honeytoolIncident, setHoneytoolIncident] = useState<any>(null)
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const { data: demoState } = useQuery({
    queryKey: ['demo-state'],
    queryFn: () => api.getDemoState(),
    refetchInterval: 10000,
  })

  useEffect(() => {
    if (!getToken()) return
    fetch('/api/settings', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json().catch(() => {}))
      .then((data) => {
        if (data?.active_palette) {
          document.documentElement.setAttribute('data-palette', data.active_palette)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdPaletteOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setCmdPaletteOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useWebSocket()

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      try {
        const data = msg.data || msg
        if (msg.type === 'honeytool_trigger' || msg.type === 'trap_activated') {
          setHoneytoolIncident({
            id: `incident-${Date.now()}`,
            agent_name: data.agent_name || 'Unknown Agent',
            agent_id: data.agent_id || '',
            tool_name: data.tool_name || 'unknown_tool',
            risk_score: data.risk_score ?? 100,
            decision: data.decision || 'QUARANTINED',
            severity: data.severity || 'CRITICAL',
            latency_ms: data.latency_ms ?? 87,
            timestamp: data.timestamp || new Date().toISOString(),
            decoy_type: data.decoy_type,
            incident_id: data.incident_id,
          })
        }
      } catch {}
    })
    return () => unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background px-4 h-11">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          {demoState?.is_active && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-success/30 bg-success/10">
              <FlaskConical className="h-3 w-3 text-success" />
              <span className="text-[10px] font-medium text-success">Demo Environment Active</span>
            </div>
          )}

          {user && (
            <div className="flex items-center gap-2 px-3">
              <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
              <RoleBadge role={user.role} />
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <NotificationCenter />
            <button
              onClick={() => setCmdPaletteOpen(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-colors"
            >
              <Command className="h-3 w-3" />
              <span>Search...</span>
              <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] ml-1">Ctrl+K</kbd>
            </button>
            <button
              onClick={() => setCmdPaletteOpen(true)}
              className="sm:hidden rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Command className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="p-5">
          <div className="mb-4 space-y-3">
            {demoState?.is_active && (
              <div className="rounded-lg border border-success/30 bg-success/[0.04] px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">Demo Environment Mode</span>
                  <Badge variant="success" className="text-[8px]">ISOLATED</Badge>
                  {demoState.current_scenario && (
                    <span className="text-xs text-muted-foreground font-mono">Scenario: {demoState.current_scenario}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">Production data is not affected</span>
              </div>
            )}
            <HoneytoolIncidentBanner incident={honeytoolIncident} onDismiss={() => setHoneytoolIncident(null)} />
          </div>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {cmdPaletteOpen && <CommandPalette onClose={() => setCmdPaletteOpen(false)} />}
      <ToastContainer />
    </div>
  )
}
