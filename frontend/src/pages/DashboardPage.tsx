import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Bot, ShieldCheck, ShieldOff, AlertTriangle, Activity,
  Terminal, Gauge, Sparkles, Eye, Search, ArrowUpRight, Clock,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie,
} from 'recharts'
import { api } from '@/services/api'
import { useDashboardStore } from '@/store/dashboard'
import { StatCard } from '@/components/layout/StatCard'
import { SecurityGrade } from '@/components/SecurityGrade'
import { Badge } from '@/components/ui/badge'
import type { DashboardData } from '@/types'

const barColors = ['hsl(142, 100%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(200, 100%, 50%)', 'hsl(280, 100%, 50%)']

export function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    staleTime: 3000,
  })

  const lastEvent = useDashboardStore((s) => s.lastEvent)
  const [flashCritical, setFlashCritical] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<string>('all')

  useEffect(() => {
    if (lastEvent?.type === 'containment') {
      setFlashCritical(true)
      setTimeout(() => setFlashCritical(false), 1500)
    }
  }, [lastEvent])

  const riskOverTime = useMemo(() => data?.risk_over_time ?? [], [data?.risk_over_time])
  const toolUsage = useMemo(() => data?.tool_usage ?? [], [data?.tool_usage])
  const agentActivity = useMemo(() => data?.agent_activity ?? [], [data?.agent_activity])

  const filteredToolUsage = useMemo(() => {
    if (selectedMetric === 'all') return toolUsage
    return toolUsage.filter(t => t.tool.toLowerCase().includes(selectedMetric))
  }, [toolUsage, selectedMetric])

  const statusDistribution = useMemo(() => {
    if (!data) return []
    const s = data.stats
    return [
      { name: 'Active', value: s.active_agents, color: 'hsl(142, 70%, 45%)' },
      { name: 'Blocked', value: s.blocked_agents, color: 'hsl(0, 72%, 51%)' },
      { name: 'Quarantined', value: s.quarantined_agents, color: 'hsl(38, 92%, 50%)' },
    ].filter(d => d.value > 0)
  }, [data])

  const latestCalls = useMemo(() => data?.recent_tool_calls.slice(0, 5) ?? [], [data?.recent_tool_calls])

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center text-danger">
          <AlertTriangle className="mx-auto h-8 w-8" />
          <p className="mt-2 text-sm">Failed to load dashboard</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { stats } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Real-time security monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-success" />
          <span className="text-xs text-muted-foreground hidden sm:inline">All Systems Nominal</span>
        </div>
      </div>

      {lastEvent?.type === 'containment' && (
        <div className={`rounded-lg border border-danger/50 bg-danger/10 p-3 ${flashCritical ? 'flash-critical' : ''}`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-danger shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-danger">Containment Alert</p>
              <p className="text-sm text-muted-foreground truncate">
                Agent <strong>{(lastEvent.data as any)?.agent_name}</strong> contained &mdash; {(lastEvent.data as any)?.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div onClick={() => navigate('/agents')} className="cursor-pointer">
          <StatCard title="Total Agents" value={stats.total_agents} icon={<Bot className="h-5 w-5" />} variant="default" />
        </div>
        <div onClick={() => navigate('/agents')} className="cursor-pointer">
          <StatCard title="Active Agents" value={stats.active_agents} icon={<ShieldCheck className="h-5 w-5" />} variant="success" />
        </div>
        <div onClick={() => navigate('/risk-events')} className="cursor-pointer">
          <StatCard title="Blocked / Quarantined" value={stats.blocked_agents + stats.quarantined_agents} icon={<ShieldOff className="h-5 w-5" />} variant="danger" />
        </div>
        <div onClick={() => navigate('/risk-events')} className="cursor-pointer">
          <StatCard title="Threats Detected" value={stats.threats_detected} icon={<AlertTriangle className="h-5 w-5" />} variant="warning" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Total Tool Calls" value={stats.total_tool_calls} icon={<Terminal className="h-5 w-5" />} />
        <StatCard title="Avg Risk Score" value={`${stats.average_risk_score.toFixed(1)}%`} icon={<Gauge className="h-5 w-5" />} variant={stats.average_risk_score > 50 ? 'warning' : 'default'} />
        <StatCard title="Risk Events Today" value={stats.risk_events_today} icon={<AlertTriangle className="h-5 w-5" />} variant={stats.risk_events_today > 0 ? 'warning' : 'default'} />
        <SecurityGrade grade={stats.average_risk_score <= 20 ? 'A' : stats.average_risk_score <= 40 ? 'B' : stats.average_risk_score <= 60 ? 'C' : stats.average_risk_score <= 80 ? 'D' : 'F'} size="md" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Risk Score Over Time
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskOverTime}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 100%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 100%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={11} tickMargin={8} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 'auto']} tickMargin={8} />
                <Tooltip />
                <Area type="monotone" dataKey="avg_score" stroke="hsl(142, 100%, 50%)" fill="url(#riskGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="max_score" stroke="hsl(38, 92%, 50%)" fill="none" strokeWidth={1} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Agent Status
          </h3>
          {statusDistribution.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
              No agents registered
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Tool Usage
            </h3>
            <div className="flex gap-1">
              {['all', 'search', 'file', 'read'].map(m => (
                <button key={m} onClick={() => setSelectedMetric(m)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    selectedMetric === m ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {m === 'all' ? 'All' : m}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredToolUsage} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="tool" stroke="var(--muted-foreground)" fontSize={10} angle={-25} textAnchor="end" tickMargin={8} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickMargin={8} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {filteredToolUsage.map((_, i) => (
                    <Cell key={i} fill={barColors[i % barColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-warning" />
            Agent Activity
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentActivity} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickMargin={8} />
                <YAxis dataKey="agent" type="category" stroke="var(--muted-foreground)" fontSize={11} width={100} tickMargin={8} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {agentActivity.map((_, i) => (
                    <Cell key={i} fill={barColors[i % barColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Latest Tool Calls
          </h3>
          <div className="space-y-2">
            {latestCalls.map((tc) => (
              <div key={tc.id} className="flex items-center justify-between rounded-lg border bg-background/50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={tc.decision === 'ALLOWED' ? 'success' : tc.decision === 'DENIED' ? 'warning' : 'danger'} className="text-[10px] shrink-0">
                    {tc.decision}
                  </Badge>
                  <span className="text-sm font-medium truncate">{tc.agent_name}</span>
                  <span className="text-xs font-mono text-muted-foreground hidden sm:inline truncate">{tc.tool_name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-mono ${tc.risk_score > 80 ? 'text-danger' : tc.risk_score > 50 ? 'text-warning' : 'text-muted-foreground'}`}>
                    {tc.risk_score.toFixed(0)}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {new Date(tc.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {latestCalls.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No tool calls yet</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Live Event Feed
          </h3>
          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {data.recent_events.slice(0, 20).map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-lg border bg-background/50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={event.decision === 'ALLOWED' ? 'success' : event.decision === 'DENIED' ? 'warning' : event.decision === 'BLOCKED' ? 'danger' : 'default'} className="text-[10px] shrink-0">
                    {event.action}
                  </Badge>
                  <span className="text-sm text-foreground truncate">{event.agent_name || 'System'}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {event.tool_name && (
                    <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{event.tool_name}</span>
                  )}
                  {event.risk_score !== null && (
                    <span className={`text-xs font-mono ${event.risk_score > 80 ? 'text-danger' : event.risk_score > 50 ? 'text-warning' : 'text-muted-foreground'}`}>
                      {event.risk_score.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
