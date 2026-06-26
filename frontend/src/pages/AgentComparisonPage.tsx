import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bot, Activity, BarChart3 } from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts'
import type { Agent, CompareAgent } from '@/types'

export function AgentComparisonPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data: agents } = useQuery<Agent[]>({ queryKey: ['agents'], queryFn: () => api.getAgents() })

  const { data: comparison, isLoading } = useQuery<CompareAgent[]>({
    queryKey: ['compare', selectedIds], queryFn: () => api.compareAgents(selectedIds),
    enabled: selectedIds.length >= 2, refetchInterval: 5000,
  })

  const toggleAgent = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const radarData = comparison ? [
    { metric: 'Tool Freq (1h)', ...Object.fromEntries(comparison.map((c) => [c.name, c.behavior.tool_frequency_1h])) },
    { metric: 'Tool Freq (24h)', ...Object.fromEntries(comparison.map((c) => [c.name, c.behavior.tool_frequency_24h])) },
    { metric: 'Denied (24h)', ...Object.fromEntries(comparison.map((c) => [c.name, c.behavior.denied_requests_24h])) },
    { metric: 'Diversity', ...Object.fromEntries(comparison.map((c) => [c.name, c.behavior.tool_diversity_24h])) },
    { metric: 'Failed', ...Object.fromEntries(comparison.map((c) => [c.name, c.behavior.failed_attempts_24h])) },
  ] : []

  const colors = ['hsl(142, 100%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(38, 92%, 50%)', 'hsl(217, 91%, 60%)', 'hsl(271, 91%, 60%)', 'hsl(190, 91%, 60%)']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Comparison</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Select 2-6 agents to compare behavior profiles side by side</p>
      </div>

      {agents && agents.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap gap-3">
            {agents.map((agent) => (
              <label key={agent.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${selectedIds.includes(agent.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}>
                <Checkbox checked={selectedIds.includes(agent.id)} onCheckedChange={() => toggleAgent(agent.id)} />
                <Bot className={`h-4 w-4 ${agent.status === 'ACTIVE' ? 'text-success' : agent.status === 'BLOCKED' ? 'text-danger' : 'text-warning'}`} />
                <div><p className="text-sm font-medium">{agent.name}</p><p className="text-[10px] text-muted-foreground">{agent.role}</p></div>
              </label>
            ))}
          </div>
          {selectedIds.length < 2 && <p className="mt-2 text-xs text-muted-foreground">Select at least 2 agents to compare</p>}
        </div>
      )}

      {comparison && comparison.length >= 2 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparison.map((agent, i) => (
              <div key={agent.id} className="rounded-lg border bg-card p-4" style={{ borderTop: `3px solid ${colors[i % colors.length]}` }}>
                <div className="flex items-center gap-2 mb-3"><Bot className="h-4 w-4" /><span className="font-semibold text-sm">{agent.name}</span></div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span>{agent.role}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={agent.status === 'ACTIVE' ? 'success' : agent.status === 'BLOCKED' ? 'danger' : 'warning'}>{agent.status}</Badge></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Risk Score</span><span className={`font-mono ${agent.risk_score > 80 ? 'text-danger' : agent.risk_score > 50 ? 'text-warning' : 'text-success'}`}>{agent.risk_score.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Calls (1h)</span><span className="font-mono">{agent.behavior.tool_frequency_1h}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Calls (24h)</span><span className="font-mono">{agent.behavior.tool_frequency_24h}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Denied</span><span className="font-mono">{agent.behavior.denied_requests_24h}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Diversity</span><span className="font-mono">{agent.behavior.tool_diversity_24h}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Failed</span><span className="font-mono">{agent.behavior.failed_attempts_24h}</span></div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-primary" /> Behavior Comparison</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="metric" stroke="var(--muted-foreground)" fontSize={10} />
                    <PolarRadiusAxis stroke="var(--muted-foreground)" fontSize={10} />
                    {comparison.map((c, i) => {
                      const color = colors[i % colors.length]
                      return <Radar key={c.id} name={c.name} dataKey={c.name} stroke={color} fill={color} fillOpacity={0.1} />
                    })}
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-primary" /> Recent Tool Calls</h3>
              <div className="space-y-3">
                {comparison.map((c) => (
                  <div key={c.id}>
                    <p className="text-xs font-medium mb-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[comparison.indexOf(c) % colors.length] }} />
                      {c.name}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {c.recent_calls.slice(0, 5).map((call, j) => (
                        <Badge key={j} variant={call.decision === 'ALLOWED' ? 'success' : call.decision === 'DENIED' ? 'warning' : 'danger'} className="text-[9px]">{call.tool_name}</Badge>
                      ))}
                      {c.recent_calls.length === 0 && <span className="text-[10px] text-muted-foreground">No recent calls</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {isLoading && <div className="flex justify-center py-8"><Activity className="h-6 w-6 animate-spin text-primary" /></div>}
    </div>
  )
}
