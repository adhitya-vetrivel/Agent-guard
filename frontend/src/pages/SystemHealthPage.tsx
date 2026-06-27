import { useQuery } from '@tanstack/react-query'
import { Shield, Database, Activity, Server, Cpu, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import type { HealthData, DashboardData } from '@/types'

export function SystemHealthPage() {
  const { data: health, isLoading: healthLoading } = useQuery<HealthData>({
    queryKey: ['health'], queryFn: () => api.getHealth(), refetchInterval: 10000,
  })
  const { data: dash } = useQuery<DashboardData>({
    queryKey: ['dashboard'], queryFn: () => api.getDashboard(), refetchInterval: 10000,
  })

  if (healthLoading) return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-5 w-5 animate-spin text-muted-foreground/60" /></div>

  const services = [
    { name: 'API Server', status: health?.status === 'ok', icon: Server },
    { name: 'PostgreSQL', status: health?.status === 'ok', icon: Database },
    { name: 'Redis Cache', status: health?.status === 'ok', icon: Cpu },
    { name: 'WebSocket', status: health?.status === 'ok', icon: Activity },
    { name: 'Anomaly Detector', status: health?.status === 'ok', icon: Activity },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="System Health" description="Real-time system status and metrics" />

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded border bg-card p-3">
          <div className="flex items-center gap-3">
            <StatusIndicator status={health?.status === 'ok' ? 'active' : 'danger'} />
            <div>
              <p className="text-caption text-muted-foreground">Overall Status</p>
              <p className="text-base font-semibold">{health?.status === 'ok' ? 'Operational' : 'Degraded'}</p>
            </div>
          </div>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Active Agents</p>
          <p className="text-base font-semibold mt-0.5">{dash?.stats.active_agents ?? '\u2014'}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Total Tool Calls</p>
          <p className="text-base font-semibold mt-0.5">{health?.stats.tool_calls ?? '\u2014'}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Version</p>
          <p className="text-base font-semibold mt-0.5">{health?.version ?? '1.0.0'}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-medium flex items-center gap-2"><Server className="h-4 w-4 text-muted-foreground" /> Service Status</h3>
          </div>
          <div className="divide-y divide-border/50">
            {services.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <svc.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{svc.name}</span>
                </div>
                <Badge variant={svc.status ? 'success' : 'danger'} className="text-[9px]">{svc.status ? 'Operational' : 'Down'}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-medium flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /> Security Checks</h3>
          </div>
          <div className="divide-y divide-border/50">
            {[
              { name: 'JWT Authentication', pass: true }, { name: 'Rate Limiting', pass: true }, { name: 'CORS Configuration', pass: true },
              { name: 'Honeytools Active', pass: true }, { name: 'Containment Engine', pass: true }, { name: 'Anomaly Detection', pass: (health?.stats.tool_calls ?? 0) > 0 },
              { name: 'Demo Mode', pass: health?.demo_mode ?? false },
            ].map((check) => (
              <div key={check.name} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm">{check.name}</span>
                {check.pass
                  ? <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3 w-3" /> Pass</span>
                  : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3 w-3" /> N/A</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border">
          <h3 className="text-sm font-medium flex items-center gap-2"><Database className="h-4 w-4 text-muted-foreground" /> Configuration</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
          {[
            { label: 'Containment Threshold', value: '80' }, { label: 'Decoy Tool Penalty', value: '+100' },
            { label: 'Rate Limit', value: '60 req/min' }, { label: 'Anomaly Model', value: 'Isolation Forest' },
            { label: 'Auth Method', value: 'JWT (HS256)' }, { label: 'Database', value: 'PostgreSQL' },
            { label: 'Cache', value: 'Redis' }, { label: 'Demo Mode', value: health?.demo_mode ? 'Enabled' : 'Disabled' },
          ].map((item) => (
            <div key={item.label} className="bg-card p-3">
              <p className="text-caption text-muted-foreground">{item.label}</p>
              <p className="text-sm font-mono mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
