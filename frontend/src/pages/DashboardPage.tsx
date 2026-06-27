import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Shield, Bot, Activity, AlertTriangle,
  Terminal, ShieldAlert, Swords, Eye
} from 'lucide-react'
import { api, request } from '@/services/api'
import { subscribe } from '@/hooks/useWebSocket'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DashboardData, Incident, Agent } from '@/types'

interface LiveLogEntry {
  id: string
  timestamp: string
  agent_name: string
  tool_name: string
  decision: string
  risk_score: number
  is_honeytool: boolean
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [liveLogs, setLiveLogs] = useState<LiveLogEntry[]>([])

  // Dashboard Aggregated query
  const { data: dashData, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    refetchInterval: 5000,
  })

  // Incidents query
  const { data: incidents } = useQuery<Incident[]>({
    queryKey: ['incidents'],
    queryFn: () => request('/incidents'),
    refetchInterval: 5000,
  })

  // HoneyTools triggers query
  const { data: honeytoolTriggers } = useQuery({
    queryKey: ['honeytool-triggers-dash'],
    queryFn: () => api.getHoneyToolTriggers(),
    refetchInterval: 5000,
  })

  // Operator risks query
  const { data: operatorRisks } = useQuery({
    queryKey: ['operator-risks-dash'],
    queryFn: () => api.getOperatorRisks(),
    refetchInterval: 10000,
  })

  // Agents list
  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.getAgents(),
    refetchInterval: 5000,
  })

  // Subscribe to central WebSocket feed
  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      try {
        const data = msg.data || msg
        const type = msg.type || data.type || ''
        if (type === 'tool_execution' || data.tool_name) {
          setLiveLogs((prev) => [
            {
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: new Date().toLocaleTimeString(),
              agent_name: data.agent_name || 'Agent',
              tool_name: data.tool_name || 'execute',
              decision: data.decision || 'ALLOWED',
              risk_score: data.risk_score || 0,
              is_honeytool: data.is_honeytool || false
            },
            ...prev
          ].slice(0, 80))
        }
      } catch {}
    })
    return () => unsubscribe()
  }, [])

  const activeIncidentsCount = useMemo(() => {
    return (incidents || []).filter(i => i.status !== 'RESOLVED' && (i.severity === 'CRITICAL' || i.severity === 'HIGH')).length
  }, [incidents])

  const containedAgentsCount = useMemo(() => {
    if (!agents) return 0
    return agents.filter(a => a.status === 'BLOCKED' || a.status === 'QUARANTINED').length
  }, [agents])

  const honeytoolTriggersCount = useMemo(() => {
    return honeytoolTriggers?.triggers?.length || 0
  }, [honeytoolTriggers])

  const avgOperatorRisk = useMemo(() => {
    if (!operatorRisks || operatorRisks.length === 0) return 0
    return operatorRisks.reduce((sum: number, r: any) => sum + (r.score || r.risk_score || 0), 0) / operatorRisks.length
  }, [operatorRisks])

  const criticalQueue = useMemo(() => {
    return (incidents || [])
      .filter((i) => i.status !== 'RESOLVED' && (i.severity === 'CRITICAL' || i.severity === 'HIGH'))
      .sort((a, b) => b.severity.localeCompare(a.severity))
      .slice(0, 8)
  }, [incidents])

  const activeFleet = useMemo(() => {
    return (agents || []).slice(0, 10)
  }, [agents])

  if (dashLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-background text-foreground">
        <Activity className="h-5 w-5 animate-spin text-muted-foreground/60" />
      </div>
    )
  }

  return (
    <div className="space-y-5 text-sm">
      {/* Title Header */}
      <div className="border-b border-border pb-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">Command Center</h1>
        <p className="text-[11px] text-muted-foreground">Runtime AI agent threat monitoring and inline firewall actions</p>
      </div>

      {/* Flat metrics row (No big widgets or gradients) */}
      <div className="grid grid-cols-4 border border-border bg-card divide-x divide-border rounded">
        <div className="p-3 text-center cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => navigate('/investigation')}>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Alerts</p>
          <p className="text-lg font-bold font-mono text-danger mt-0.5">{activeIncidentsCount}</p>
        </div>
        <div className="p-3 text-center cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => navigate('/fleet')}>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Contained Agents</p>
          <p className="text-lg font-bold font-mono text-success mt-0.5">{containedAgentsCount}</p>
        </div>
        <div className="p-3 text-center cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => navigate('/deception-center')}>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Baited Traps</p>
          <p className="text-lg font-bold font-mono text-purple-400 mt-0.5">{honeytoolTriggersCount}</p>
        </div>
        <div className="p-3 text-center cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => navigate('/operator-security')}>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Operator Risk</p>
          <p className="text-lg font-bold font-mono text-warning mt-0.5">{avgOperatorRisk.toFixed(0)}</p>
        </div>
      </div>

      {/* Main Split-Pane Layout */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Left Side: Fleet & Live Logs */}
        <div className="lg:col-span-8 space-y-5">
          {/* Active Fleet Table */}
          <div className="rounded border bg-card overflow-hidden">
            <div className="px-3.5 py-2 border-b bg-muted/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Agent Fleet</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b bg-muted/20 text-muted-foreground font-semibold">
                    <th className="px-4 py-2">Agent Name</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2 text-right">Risk Score</th>
                    <th className="px-4 py-2 text-right">Containment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {activeFleet.map((agent) => (
                    <tr key={agent.id} className="hover:bg-muted/10 cursor-pointer" onClick={() => navigate(`/fleet?id=${agent.id}`)}>
                      <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                        <StatusIndicator status={agent.status === 'ACTIVE' ? 'active' : agent.status === 'BLOCKED' ? 'danger' : 'warning'} />
                        {agent.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{agent.role}</td>
                      <td className={cn("px-4 py-2.5 text-right font-mono font-bold", agent.risk_score > 70 ? 'text-danger' : agent.risk_score > 40 ? 'text-warning' : 'text-success')}>
                        {agent.risk_score.toFixed(0)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={agent.status === 'ACTIVE' ? 'success' : 'danger'} className="text-[9px] tracking-wide font-mono uppercase">
                          {agent.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {activeFleet.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-muted-foreground">No agents active in registry</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Operations Feed */}
          <div className="rounded border bg-card overflow-hidden">
            <div className="px-3.5 py-2 border-b bg-muted/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Operations Feed</h3>
              </div>
              <Badge variant="outline" className="text-[8px] font-mono tracking-wider">WS TELEMETRY CONNECTED</Badge>
            </div>
            <div className="bg-black/40 p-4 h-[240px] overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin">
              {liveLogs.length === 0 && dashData?.recent_events ? (
                dashData.recent_events.slice(0, 15).map((log) => (
                  <div key={log.id} className="flex justify-between gap-3 text-muted-foreground/80 border-b border-border/5 pb-1">
                    <span>
                      <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
                      <span className="text-primary font-semibold">{log.agent_name || 'Agent'}</span>:{" "}
                      <code className="text-purple-300 font-mono">{log.tool_name}()</code>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[10px] font-mono', (log.risk_score ?? 0) > 70 ? 'text-danger font-bold' : 'text-muted-foreground')}>
                        {(log.risk_score ?? 0).toFixed(0)}
                      </span>
                      <Badge variant={log.decision === 'ALLOWED' ? 'success' : 'danger'} className="text-[7px] leading-none px-1 py-0.5">{log.decision}</Badge>
                    </div>
                  </div>
                ))
              ) : liveLogs.map((log) => (
                <div key={log.id} className="flex justify-between gap-3 text-muted-foreground/80 border-b border-border/5 pb-1">
                  <span>
                    <span className="text-muted-foreground">[{log.timestamp}]</span>{" "}
                    <span className="text-primary font-semibold">{log.agent_name}</span>:{" "}
                    <code className="text-purple-300 font-mono">{log.tool_name}()</code>
                  </span>
                  <div className="flex items-center gap-2">
                    {log.risk_score !== null && <span className={cn('text-[10px] font-mono', (log.risk_score ?? 0) > 70 ? 'text-danger font-bold' : 'text-muted-foreground')}>{ (log.risk_score ?? 0).toFixed(0) }</span>}
                    <Badge variant={log.decision === 'ALLOWED' ? 'success' : 'danger'} className="text-[7px] leading-none px-1 py-0.5">{log.decision}</Badge>
                  </div>
                </div>
              ))}
              {liveLogs.length === 0 && (!dashData?.recent_events || dashData.recent_events.length === 0) && (
                <div className="h-full flex items-center justify-center text-muted-foreground/50">
                  <p>Listening for agent system tool executions...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Critical Alerts Queue */}
        <div className="lg:col-span-4">
          <div className="rounded border bg-card overflow-hidden">
            <div className="px-3.5 py-2 border-b bg-muted/10 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-danger" /> Critical Alerts
              </h3>
              <Badge variant="outline" className="font-mono text-[9px] cursor-pointer" onClick={() => navigate('/investigation')}>
                View All
              </Badge>
            </div>
            <div className="divide-y divide-border/40 max-h-[500px] overflow-y-auto">
              {criticalQueue.map((inc) => (
                <div key={inc.id} className="p-3 hover:bg-muted/10 cursor-pointer transition-colors" onClick={() => navigate(`/investigation?id=${inc.id}`)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-foreground">{inc.agent_name}</span>
                    <Badge variant="danger" className="text-[8px] font-mono">{inc.severity}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed break-words">{inc.trigger_reason}</p>
                  <span className="text-[9px] text-muted-foreground block mt-1.5 font-mono">{new Date(inc.created_at || '').toLocaleString()}</span>
                </div>
              ))}
              {criticalQueue.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No active unresolved critical alerts</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
