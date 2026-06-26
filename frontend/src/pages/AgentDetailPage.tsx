import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Bot, Activity, Terminal, ShieldOff, Sparkles } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { AgentDetail, BehaviorProfile, AuditLog, RiskEvent } from '@/types'

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: agent, isLoading: agentLoading } = useQuery<AgentDetail>({ queryKey: ['agent', id], queryFn: () => api.getAgent(id!), enabled: !!id })
  const { data: behavior } = useQuery<BehaviorProfile>({ queryKey: ['agent-behavior', id], queryFn: () => api.getAgentBehavior(id!), enabled: !!id, refetchInterval: 5000 })
  const { data: auditLogs } = useQuery<AuditLog[]>({ queryKey: ['agent-audit', id], queryFn: () => api.getAgentAudit(id!), enabled: !!id })
  const { data: riskEvents } = useQuery<RiskEvent[]>({ queryKey: ['risk-events', id], queryFn: () => api.getRiskEvents().then(events => events.filter(e => e.agent_id === id)), enabled: !!id })

  if (agentLoading) return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-8 w-8 animate-spin text-primary" /></div>
  if (!agent) return <div className="flex h-[80vh] items-center justify-center"><p className="text-muted-foreground">Agent not found</p></div>

  const riskChartData = riskEvents?.map((e) => ({ time: new Date(e.created_at).toLocaleTimeString(), score: e.risk_score })).reverse() || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/agents')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={`rounded-lg p-2 ${agent.status === 'ACTIVE' ? 'bg-success/10' : 'bg-danger/10'}`}>
            <Bot className={`h-5 w-5 ${agent.status === 'ACTIVE' ? 'text-success' : 'text-danger'}`} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{agent.name}</h1>
            <p className="text-sm text-muted-foreground truncate">ID: {agent.id}</p>
          </div>
        </div>
        <Badge variant={agent.status === 'ACTIVE' ? 'success' : agent.status === 'BLOCKED' ? 'danger' : 'warning'} className="self-start sm:self-center">{agent.status}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Terminal className="h-3 w-3" /> Role</p>
          <p className="text-lg font-semibold">{agent.role}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><ShieldOff className="h-3 w-3" /> Risk Score</p>
          <p className={`text-lg font-semibold ${agent.risk_score > 80 ? 'text-danger' : agent.risk_score > 50 ? 'text-warning' : 'text-success'}`}>{agent.risk_score.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Activity className="h-3 w-3" /> Last Seen</p>
          <p className="text-lg font-semibold">{agent.last_seen ? new Date(agent.last_seen).toLocaleString() : 'Never'}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Behavior Profile</h3>
          {behavior && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Tool Frequency (1h)', value: behavior.tool_frequency_1h },
                { label: 'Tool Frequency (24h)', value: behavior.tool_frequency_24h },
                { label: 'Denied Requests', value: behavior.denied_requests_24h },
                { label: 'Tool Diversity', value: behavior.tool_diversity_24h },
              ].map((f) => (
                <div key={f.label} className="rounded-lg bg-muted/20 p-3 border">
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className="text-xl font-bold">{f.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-danger" /> Risk Score History</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskChartData}>
                <defs><linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={10} tickMargin={8} />
                <YAxis domain={[0, 'auto']} stroke="var(--muted-foreground)" fontSize={10} tickMargin={8} />
                <Tooltip />
                <Area type="monotone" dataKey="score" stroke="hsl(0, 72%, 51%)" fill="url(#rGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-semibold">Recent Tool Calls</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b"><th className="px-3 py-2 text-left text-muted-foreground font-medium">Tool</th><th className="px-3 py-2 text-left text-muted-foreground font-medium">Decision</th><th className="px-3 py-2 text-left text-muted-foreground font-medium">Risk</th><th className="px-3 py-2 text-left text-muted-foreground font-medium hidden sm:table-cell">Time</th></tr>
            </thead>
            <tbody>
              {auditLogs?.slice(0, 20).map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs">{log.tool_name || '\u2014'}</td>
                  <td className="px-3 py-2"><Badge variant={log.decision === 'ALLOWED' ? 'success' : log.decision === 'DENIED' ? 'warning' : 'danger'}>{log.decision || '\u2014'}</Badge></td>
                  <td className="px-3 py-2"><span className={`font-mono text-xs ${(log.risk_score || 0) > 80 ? 'text-danger' : (log.risk_score || 0) > 50 ? 'text-warning' : 'text-success'}`}>{log.risk_score?.toFixed(0) || '0'}</span></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-semibold">Capabilities</h3>
        <div className="flex flex-wrap gap-2">{agent.capabilities.map((cap) => (<Badge key={cap} variant="outline" className="font-mono text-xs">{cap}</Badge>))}</div>
      </div>
    </div>
  )
}
