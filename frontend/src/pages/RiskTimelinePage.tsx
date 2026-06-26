import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Activity, AlertTriangle, Clock, Filter } from 'lucide-react'
import { request } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface RiskEventType {
  id: string; agent_name: string; severity: string; risk_score: number; reason: string; tool_name: string | null; created_at: string
}

export function RiskTimelinePage() {
  const [timeRange, setTimeRange] = useState(24)
  const [severityFilter, setSeverityFilter] = useState('')

  const { data: events } = useQuery<RiskEventType[]>({
    queryKey: ['risk-events'], queryFn: () => request('/risk-events'), refetchInterval: 5000,
  })

  const filtered = useMemo(() => {
    if (!events) return []
    let result = [...events]
    if (severityFilter) result = result.filter(e => e.severity === severityFilter)
    const cutoff = Date.now() - timeRange * 60 * 60 * 1000
    result = result.filter(e => new Date(e.created_at).getTime() > cutoff)
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [events, severityFilter, timeRange])

  const chartData = useMemo(() => {
    const buckets: Record<string, { time: string; avg: number; max: number; count: number; events: number }> = {}
    for (const e of filtered) {
      const h = new Date(e.created_at).getHours()
      const key = `${h}:00`
      if (!buckets[key]) buckets[key] = { time: key, avg: 0, max: 0, count: 0, events: 0 }
      buckets[key].avg += e.risk_score
      buckets[key].max = Math.max(buckets[key].max, e.risk_score)
      buckets[key].count++
      buckets[key].events++
    }
    for (const key of Object.keys(buckets)) buckets[key].avg = Math.round(buckets[key].avg / buckets[key].count)
    return Object.values(buckets).sort((a, b) => a.time.localeCompare(b.time))
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Risk Timeline</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Risk score evolution with event overlay</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {[1, 6, 24, 72].map(h => (
            <button key={h} onClick={() => setTimeRange(h)}
              className={cn('px-3 py-1.5 text-xs rounded-md transition-colors', timeRange === h ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}>{h}h</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-primary" /> Risk Score Over Time</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.length > 0 ? chartData : [{ time: '00:00', avg: 0, max: 0, count: 0, events: 0 }]}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={11} tickMargin={8} />
                <YAxis domain={[0, 'auto']} stroke="var(--muted-foreground)" fontSize={11} tickMargin={8} />
                <Tooltip />
                <Area type="monotone" dataKey="avg" stroke="hsl(0, 72%, 51%)" fill="url(#riskGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="max" stroke="hsl(38, 92%, 50%)" fill="none" strokeWidth={1} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-warning" /> Filter by Severity</h3>
          <div className="space-y-1">
            {['', 'SAFE', 'WARNING', 'HIGH', 'CRITICAL'].map(s => (
              <button key={s} onClick={() => setSeverityFilter(s)}
                className={cn('w-full text-left px-3 py-2 rounded text-xs transition-colors', severityFilter === s ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50')}>
                {s || 'All Severities'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-primary" /> Event Timeline</h3>
        <div className="max-h-[500px] overflow-y-auto space-y-1">
          {filtered.slice(0, 100).map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-muted/30 text-xs border-b last:border-0">
              <span className={cn('w-2 h-2 rounded-full shrink-0', e.severity === 'CRITICAL' ? 'bg-danger' : e.severity === 'HIGH' ? 'bg-warning' : e.severity === 'WARNING' ? 'bg-yellow-500' : 'bg-success')} />
              <span className="text-muted-foreground w-16 shrink-0 font-mono">{new Date(e.created_at).toLocaleTimeString()}</span>
              <Badge variant={e.severity === 'CRITICAL' ? 'danger' : e.severity === 'HIGH' ? 'warning' : 'default'} className="text-[8px] shrink-0">{e.severity}</Badge>
              <span className="font-mono text-muted-foreground w-16 shrink-0">{e.risk_score.toFixed(0)}</span>
              <span className="truncate">{e.reason}</span>
              {e.tool_name && <Badge variant="outline" className="text-[8px] shrink-0">{e.tool_name}</Badge>}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No risk events recorded</p>}
        </div>
      </div>
    </div>
  )
}
