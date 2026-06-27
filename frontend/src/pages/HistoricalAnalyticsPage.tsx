import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Download, TrendingUp, TrendingDown, Minus, Activity, Shield, ShieldAlert, Bot, Clock } from 'lucide-react'
import { api } from '@/services/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { CardSkeleton, GraphSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import type { RiskEvent } from '@/types'

const TIME_RANGES = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
]

export function HistoricalAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('24h')

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => api.getDashboard(),
    refetchInterval: 30000,
  })

  const { data: anomalyData, isLoading: anomalyLoading } = useQuery({
    queryKey: ['anomaly-analytics'],
    queryFn: () => api.getAnomalyDashboard(),
    refetchInterval: 30000,
  })

  const { data: riskEvents, isLoading: riskLoading } = useQuery({
    queryKey: ['risk-events-analytics'],
    queryFn: () => api.getRiskEvents(),
    refetchInterval: 30000,
  })

  const riskOverTime = dashboard?.risk_over_time || []
  const stats = dashboard?.stats
  const profiles = anomalyData?.profiles || []
  const totalCalls = anomalyData?.total_calls || 0
  const anomalyCount = anomalyData?.anomaly_count || 0

  const maxRisk = Math.max(...riskOverTime.map((r: any) => r.avg_score), 1)
  const maxToolCount = Math.max(...(dashboard?.tool_usage || []).map((t: any) => t.count), 1)

  const severityCounts = (riskEvents as RiskEvent[] || []).reduce((acc: Record<string, number>, e) => {
    acc[e.severity] = (acc[e.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-5">
      <PageHeader title="Historical Analytics" description="Trends and patterns across agent activity, risk, and anomalies">
        <div className="flex items-center gap-2">
          <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}
            options={TIME_RANGES.map((r) => ({ value: r.value, label: r.label }))} className="w-36" />
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border">
            <Download className="h-3 w-3" /> Export
          </button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-5 gap-3">
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Total Calls</p>
          <p className="text-h2 font-semibold tabular-nums mt-0.5">{totalCalls || stats?.total_tool_calls || 0}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Threats Detected</p>
          <p className="text-h2 font-semibold tabular-nums mt-0.5 text-warning">{stats?.threats_detected || 0}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Anomalies</p>
          <p className="text-h2 font-semibold tabular-nums mt-0.5 text-danger">{anomalyCount}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Risk Today</p>
          <p className="text-h2 font-semibold tabular-nums mt-0.5">{stats?.risk_events_today || 0}</p>
        </div>
        <div className="rounded border bg-card p-3">
          <p className="text-caption text-muted-foreground">Avg Risk Score</p>
          <p className={cn('text-h2 font-semibold tabular-nums mt-0.5', (stats?.average_risk_score || 0) > 60 ? 'text-danger' : (stats?.average_risk_score || 0) > 30 ? 'text-warning' : 'text-success')}>
            {(stats?.average_risk_score || 0).toFixed(0)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" /> Risk Over Time</h3>
          </div>
          {dashLoading ? <GraphSkeleton /> : (
            <div className="p-4">
              <div className="flex items-end gap-1 h-36">
                {riskOverTime.slice(0, 24).map((point: any, i: number) => {
                  const h = (point.avg_score / (maxRisk || 1)) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-muted px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap z-10">
                        <span className="font-medium">{point.time}</span> — {point.avg_score.toFixed(0)} (max: {point.max_score})
                      </div>
                      <div className="w-full rounded-t" style={{
                        height: `${Math.max(h, 2)}%`,
                        backgroundColor: point.avg_score > 70 ? 'hsla(0, 72%, 51%, 0.7)' : point.avg_score > 40 ? 'hsla(35, 100%, 50%, 0.7)' : 'hsla(142, 60%, 42%, 0.7)',
                      }} />
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
                <span>{riskOverTime[0]?.time || ''}</span>
                <span>{riskOverTime[riskOverTime.length - 1]?.time || ''}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-medium flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" /> Tool Usage</h3>
          </div>
          {dashLoading ? <GraphSkeleton /> : (
            <div className="p-4 space-y-2">
              {(dashboard?.tool_usage || []).slice(0, 10).map((tool: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-32 truncate text-muted-foreground">{tool.tool}</span>
                  <div className="flex-1 h-4 rounded bg-muted/30 overflow-hidden">
                    <div className="h-full rounded bg-primary/40" style={{ width: `${(tool.count / maxToolCount) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-muted-foreground w-10 text-right">{tool.count}</span>
                </div>
              ))}
              {(!dashboard?.tool_usage || dashboard.tool_usage.length === 0) && (
                <p className="text-xs text-muted-foreground py-4 text-center">No tool usage data</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-medium flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /> Severity Distribution</h3>
          </div>
          {riskLoading ? <CardSkeleton /> : (
            <div className="p-4 space-y-2">
              {[
                { key: 'CRITICAL', label: 'Critical', color: 'bg-danger' },
                { key: 'HIGH', label: 'High', color: 'bg-warning' },
                { key: 'WARNING', label: 'Warning', color: 'bg-warning/60' },
                { key: 'SAFE', label: 'Safe', color: 'bg-success' },
              ].map((sev) => {
                const count = severityCounts[sev.key] || 0
                const total = (riskEvents as RiskEvent[] || []).length || 1
                return (
                  <div key={sev.key} className="flex items-center gap-3">
                    <span className="text-xs w-16">{sev.label}</span>
                    <div className="flex-1 h-4 rounded bg-muted/30 overflow-hidden">
                      <div className={cn('h-full rounded', sev.color)} style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono tabular-nums w-8 text-right text-muted-foreground">{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-medium flex items-center gap-2"><Bot className="h-4 w-4 text-muted-foreground" /> Anomaly Profiles</h3>
          </div>
          {anomalyLoading ? <CardSkeleton /> : (
            <div className="divide-y divide-border/50">
              {profiles.slice(0, 10).map((p: any, i: number) => (
                <div key={p.agent_id || i} className="px-3 py-2 flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('h-2 w-2 rounded-full', p.is_anomaly ? 'bg-danger' : 'bg-success')} />
                    <span className="text-sm truncate">{p.agent_name || p.agent_id}</span>
                    {p.is_anomaly && <ShieldAlert className="h-3 w-3 text-danger" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{p.tool_frequency_1h || 0}/h</span>
                    <span className={cn('font-mono tabular-nums', p.risk_score > 80 ? 'text-danger' : p.risk_score > 50 ? 'text-warning' : 'text-success')}>
                      {p.risk_score?.toFixed(0) || '0'}
                    </span>
                  </div>
                </div>
              ))}
              {profiles.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No anomaly data</p>}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border">
          <h3 className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" /> Agent Activity</h3>
        </div>
        {dashLoading ? <GraphSkeleton /> : (
          <div className="divide-y divide-border/50">
            {(dashboard?.agent_activity || []).slice(0, 15).map((a: any, i: number) => (
              <div key={i} className="px-3 py-2 flex items-center justify-between hover:bg-muted/20 transition-colors">
                <span className="text-sm">{a.agent}</span>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">{a.count} calls</span>
              </div>
            ))}
            {(!dashboard?.agent_activity || dashboard.agent_activity.length === 0) && (
              <p className="py-6 text-center text-xs text-muted-foreground">No activity data</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
