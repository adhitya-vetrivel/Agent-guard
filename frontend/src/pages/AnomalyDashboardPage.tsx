import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Shield, Brain, Gauge, Bot } from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { AnomalyDashboard } from '@/types'

export function AnomalyDashboardPage() {
  const { data, isLoading } = useQuery<AnomalyDashboard>({
    queryKey: ['anomaly-dashboard'], queryFn: () => api.getAnomalyDashboard(), refetchInterval: 5000,
  })

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-8 w-8 animate-spin text-primary" /></div>

  const anomalyProfiles = data?.profiles || []
  const normalCount = anomalyProfiles.filter((p) => !p.is_anomaly).length
  const anomalyCount = anomalyProfiles.filter((p) => p.is_anomaly).length

  const chartData = anomalyProfiles.map((p) => ({
    name: p.agent_name, 'Anomaly Score': +(p.anomaly_score * 100).toFixed(0), 'Risk Score': p.risk_score,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Anomaly Detection</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">ML-based behavior analysis using Isolation Forest</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-primary/10"><Brain className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Model Status</p><p className="text-lg font-bold">{data?.model_initialized ? 'Trained' : 'Learning'}</p></div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-success/10"><Shield className="h-5 w-5 text-success" /></div>
            <div><p className="text-xs text-muted-foreground">Normal</p><p className="text-lg font-bold">{normalCount}</p></div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-danger/10"><AlertTriangle className="h-5 w-5 text-danger" /></div>
            <div><p className="text-xs text-muted-foreground">Anomalies</p><p className="text-lg font-bold">{anomalyCount}</p></div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-muted/30"><Activity className="h-5 w-5 text-muted-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Samples</p><p className="text-lg font-bold">{data?.samples_collected || 0}</p></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Gauge className="h-4 w-4 text-primary" /> Agent Anomaly & Risk Scores</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickMargin={8} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} tickMargin={8} />
                <Tooltip />
                <Bar dataKey="Anomaly Score" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Risk Score" fill="hsl(142, 100%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Brain className="h-4 w-4 text-primary" /> Agent Analysis</h3>
          <div className="space-y-2">
            {anomalyProfiles.map((profile) => (
              <div key={profile.agent_id} className={`rounded-lg p-3 border ${profile.is_anomaly ? 'border-danger/30 bg-danger/5' : 'bg-muted/20'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bot className={`h-4 w-4 ${profile.is_anomaly ? 'text-danger' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">{profile.agent_name}</span>
                    <Badge variant={profile.is_anomaly ? 'danger' : 'success'} className="text-[9px]">{profile.is_anomaly ? 'Anomaly' : 'Normal'}</Badge>
                  </div>
                  <span className={`text-xs font-mono ${profile.anomaly_score > 0.5 ? 'text-danger' : 'text-muted-foreground'}`}>Score: {(profile.anomaly_score * 100).toFixed(0)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                  <span>Calls (1h): {profile.tool_frequency_1h}</span><span>Calls (24h): {profile.tool_frequency_24h}</span>
                  <span>Denied: {profile.denied_requests_24h}</span><span>Diversity: {profile.tool_diversity_24h}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${profile.anomaly_score > 0.7 ? 'bg-danger' : profile.anomaly_score > 0.4 ? 'bg-warning' : 'bg-success'}`}
                    style={{ width: `${profile.anomaly_score * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data && data.events.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-primary" /> Recent Risk Events</h3>
          <div className="space-y-2">
            {data.events.slice(0, 10).map((event) => (
              <div key={event.id} className="flex items-center gap-3 rounded-lg bg-muted/20 p-3">
                <AlertTriangle className={`h-4 w-4 shrink-0 ${event.severity === 'CRITICAL' ? 'text-danger' : event.severity === 'HIGH' ? 'text-warning' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{event.reason}</p>
                  <p className="text-xs text-muted-foreground">{event.agent_name} &middot; {new Date(event.created_at).toLocaleString()}</p>
                </div>
                <Badge variant={event.severity === 'CRITICAL' ? 'danger' : event.severity === 'HIGH' ? 'warning' : 'default'} className="text-[9px]">{event.severity}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
