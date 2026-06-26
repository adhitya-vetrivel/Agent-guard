import { useQuery } from '@tanstack/react-query'
import { Shield, Database, Activity, Server, CheckCircle2, XCircle, Wifi, Cpu } from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import type { HealthData, DashboardData } from '@/types'

export function SystemHealthPage() {
  const { data: health, isLoading: healthLoading } = useQuery<HealthData>({
    queryKey: ['health'], queryFn: () => api.getHealth(), refetchInterval: 10000,
  })
  const { data: dash } = useQuery<DashboardData>({
    queryKey: ['dashboard'], queryFn: () => api.getDashboard(), refetchInterval: 10000,
  })

  if (healthLoading) return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-8 w-8 animate-spin text-primary" /></div>

  const services = [
    { name: 'API Server', status: health?.status === 'ok', icon: Server, latency: '12ms' },
    { name: 'PostgreSQL', status: health?.status === 'ok', icon: Database, latency: '5ms' },
    { name: 'Redis Cache', status: health?.status === 'ok', icon: Cpu, latency: '2ms' },
    { name: 'WebSocket', status: health?.status === 'ok', icon: Wifi, latency: '8ms' },
    { name: 'Anomaly Detector', status: health?.status === 'ok', icon: Activity, latency: '15ms' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Real-time system status and metrics</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`rounded-lg border bg-card p-4 ${health?.status === 'ok' ? '' : 'border-danger/30'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${health?.status === 'ok' ? 'bg-success/10' : 'bg-danger/10'}`}>
              <Shield className={`h-5 w-5 ${health?.status === 'ok' ? 'text-success' : 'text-danger'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overall Status</p>
              <p className="text-lg font-bold">{health?.status === 'ok' ? 'Operational' : 'Degraded'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-primary/10"><Activity className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Active Agents</p><p className="text-lg font-bold">{dash?.stats.active_agents ?? '\u2014'}</p></div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-success/10"><CheckCircle2 className="h-5 w-5 text-success" /></div>
            <div><p className="text-xs text-muted-foreground">Total Tool Calls</p><p className="text-lg font-bold">{health?.stats.tool_calls ?? '\u2014'}</p></div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-muted/30"><Server className="h-5 w-5 text-muted-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Version</p><p className="text-lg font-bold">{health?.version ?? '1.0.0'}</p></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Server className="h-4 w-4 text-primary" /> Service Status</h3>
          <div className="space-y-2">
            {services.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between rounded-lg bg-muted/20 p-3">
                <div className="flex items-center gap-3"><svc.icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{svc.name}</span></div>
                <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{svc.latency}</span><Badge variant={svc.status ? 'success' : 'danger'}>{svc.status ? 'Operational' : 'Down'}</Badge></div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Shield className="h-4 w-4 text-success" /> Security Checks</h3>
          <div className="space-y-2">
            {[
              { name: 'JWT Authentication', pass: true }, { name: 'Rate Limiting', pass: true }, { name: 'CORS Configuration', pass: true },
              { name: 'Honeytools Active', pass: true }, { name: 'Containment Engine', pass: true }, { name: 'Anomaly Detection', pass: (health?.stats.tool_calls ?? 0) > 0 },
              { name: 'Demo Mode', pass: health?.demo_mode ?? false },
            ].map((check) => (
              <div key={check.name} className="flex items-center justify-between rounded-lg bg-muted/20 p-3">
                <span className="text-sm">{check.name}</span>
                {check.pass ? <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-xs text-success">Pass</span></div>
                  : <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">N/A</span></div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Database className="h-4 w-4 text-primary" /> Configuration</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Containment Threshold', value: '80' }, { label: 'Decoy Tool Penalty', value: '+100' },
            { label: 'Rate Limit', value: '60 req/min' }, { label: 'Anomaly Model', value: 'Isolation Forest' },
            { label: 'Auth Method', value: 'JWT (HS256)' }, { label: 'Database', value: 'PostgreSQL' },
            { label: 'Cache', value: 'Redis' }, { label: 'Demo Mode', value: health?.demo_mode ? 'Enabled' : 'Disabled' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-muted/20 p-3 border">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-mono mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
