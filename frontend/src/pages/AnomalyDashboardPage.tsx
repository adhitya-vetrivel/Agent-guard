import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Shield, Brain, Bot } from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { cn } from '@/lib/utils'
import type { AnomalyDashboard } from '@/types'

export function AnomalyDashboardPage() {
  const { data, isLoading } = useQuery<AnomalyDashboard>({
    queryKey: ['anomaly-dashboard'], queryFn: () => api.getAnomalyDashboard(), refetchInterval: 5000,
  })

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-5 w-5 animate-spin text-muted-foreground/60" /></div>

  const anomalyProfiles = data?.profiles || []
  const normalCount = anomalyProfiles.filter((p) => !p.is_anomaly).length
  const anomalyCount = anomalyProfiles.filter((p) => p.is_anomaly).length

  const chartData = anomalyProfiles.map((p) => ({
    name: p.agent_name, 'Anomaly Score': +(p.anomaly_score * 100).toFixed(0), 'Risk Score': p.risk_score,
  }))

  return (
    <div className="space-y-5">
      <PageHeader title="Anomaly Detection" description="ML-based behavior analysis using Isolation Forest" />

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Model Status</p>
          <p className="text-base font-semibold mt-0.5">{data?.model_initialized ? 'Trained' : 'Learning'}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Normal Agents</p>
          <p className="text-base font-semibold mt-0.5 text-success">{normalCount}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Anomalies</p>
          <p className="text-base font-semibold mt-0.5 text-danger">{anomalyCount}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Samples Collected</p>
          <p className="text-base font-semibold mt-0.5">{data?.samples_collected || 0}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" /> Agent Anomaly & Risk Scores</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickMargin={6} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} tickMargin={6} />
                <Tooltip />
                <Bar dataKey="Anomaly Score" fill="hsl(0, 72%, 51%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Risk Score" fill="hsl(212, 100%, 55%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Brain className="h-4 w-4 text-muted-foreground" /> Agent Analysis</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {anomalyProfiles.map((profile) => (
              <div key={profile.agent_id} className={`rounded border p-3 ${profile.is_anomaly ? 'border-danger/30 bg-danger/[0.02]' : 'bg-muted/20'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={profile.is_anomaly ? 'danger' : 'active'} />
                    <span className="text-sm font-medium">{profile.agent_name}</span>
                    <Badge variant={profile.is_anomaly ? 'danger' : 'success'} className="text-[8px]">{profile.is_anomaly ? 'Anomaly' : 'Normal'}</Badge>
                  </div>
                  <span className={cn('text-xs font-mono', profile.anomaly_score > 0.5 ? 'text-danger' : 'text-muted-foreground')}>
                    {(profile.anomaly_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption text-muted-foreground">
                  <span>Calls (1h): {profile.tool_frequency_1h}</span>
                  <span>Calls (24h): {profile.tool_frequency_24h}</span>
                  <span>Denied: {profile.denied_requests_24h}</span>
                  <span>Diversity: {profile.tool_diversity_24h}</span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                  <div className={cn('h-full rounded-full', profile.anomaly_score > 0.7 ? 'bg-danger' : profile.anomaly_score > 0.4 ? 'bg-warning' : 'bg-success')}
                    style={{ width: `${profile.anomaly_score * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data && data.events.length > 0 && (
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" /> Recent Risk Events</h3>
          </div>
          <div className="divide-y divide-border/50">
            {data.events.slice(0, 10).map((event) => (
              <div key={event.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20">
                <StatusIndicator status={event.severity === 'CRITICAL' ? 'danger' : event.severity === 'HIGH' ? 'warning' : 'active'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{event.reason}</p>
                  <p className="text-caption text-muted-foreground">{event.agent_name} &middot; {new Date(event.created_at).toLocaleString()}</p>
                </div>
                <Badge variant={event.severity === 'CRITICAL' ? 'danger' : event.severity === 'HIGH' ? 'warning' : 'default'} className="text-[8px] shrink-0">{event.severity}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
