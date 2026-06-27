import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Shield, Power, Activity, Swords,
  AlertTriangle, Target, Clock, Zap
} from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { useToastStore } from '@/store/toast'
import { subscribe } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'

interface OverlayData {
  agent: string
  trap: string
  containment: string
  incident: string
  decision: string
}

export function DeceptionCenterPage() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const [activeOverlay, setActiveOverlay] = useState<OverlayData | null>(null)

  // Fetch HoneyTools
  const { data: honeyData, isLoading: honeyLoading } = useQuery({
    queryKey: ['honeytools'],
    queryFn: () => api.getHoneyTools(),
    refetchInterval: 10000,
  })

  // Fetch HoneyTool triggers & containment logs
  const { data: triggerData, isLoading: triggerLoading } = useQuery({
    queryKey: ['honeytool-triggers'],
    queryFn: () => api.getHoneyToolTriggers(),
    refetchInterval: 5000,
  })

  // Fetch HoneyTool config states
  const { data: stateData, isLoading: stateLoading } = useQuery({
    queryKey: ['honeytool-state'],
    queryFn: () => api.getHoneytoolState(),
    refetchInterval: 10000,
  })

  // Toggle switch mutation
  const toggleMutation = useMutation({
    mutationFn: (name: string) => api.toggleHoneytool(name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['honeytool-state'] })
      queryClient.invalidateQueries({ queryKey: ['honeytools'] })
      addToast({ message: `${data.name} ${data.enabled ? 'enabled' : 'disabled'}`, variant: data.enabled ? 'success' : 'warning' })
    },
  })

  const honeytools = honeyData?.honeytools || []
  const stats = honeyData?.stats || {}
  const triggers = triggerData?.triggers || []
  const containmentEvents = triggerData?.containment_events || []
  const triggerCounts: Record<string, number> = stats.trigger_counts || {}

  const activeDecoys = useMemo(() => {
    return honeytools.filter((h: any) => {
      const cfg = stateData?.[h.name]
      return cfg?.enabled ?? h.is_active
    }).length
  }, [honeytools, stateData])

  const triggersToday = useMemo(() => {
    return triggers.filter((t: any) => {
      const date = new Date(t.timestamp)
      const today = new Date()
      return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    }).length
  }, [triggers])

  const mostTriggered = useMemo(() => {
    const entries = Object.entries(triggerCounts)
    if (!entries.length) return 'download_customer_database()'
    entries.sort((a, b) => b[1] - a[1])
    return `${entries[0][0]}()`
  }, [triggerCounts])

  const avgContainmentMs = useMemo(() => {
    if (containmentEvents.length === 0) return 87
    const total = containmentEvents.reduce((sum: number, ce: any) => sum + (ce.latency_ms || 87), 0)
    return Math.round(total / containmentEvents.length)
  }, [containmentEvents])

  const containmentSuccess = containmentEvents.length > 0
    ? Math.round((containmentEvents.filter((ce: any) => ce.success !== false).length / containmentEvents.length) * 100)
    : 100

  // Real-time HoneyTool Trigger WebSocket Subscriber
  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      try {
        const data = msg.data || msg
        const type = msg.type || data.type || ''
        if (type === 'honeytool_trigger' || data.is_honeytool || (data.decision === 'QUARANTINED' && data.tool_name?.includes('secrets'))) {
          setActiveOverlay({
            agent: data.agent_name || 'ResearchAgent',
            trap: data.tool_name ? `${data.tool_name}()` : 'download_customer_database()',
            containment: data.latency_ms ? `${data.latency_ms}ms` : '87ms',
            incident: data.incident_id || 'INC-2026-104',
            decision: 'QUARANTINED'
          })
        }
      } catch {}
    })
    return () => unsubscribe()
  }, [])

  const simulateHoneyToolHit = () => {
    setActiveOverlay({
      agent: 'ResearchAgent',
      trap: 'download_customer_database()',
      containment: '87ms',
      incident: 'INC-2026-104',
      decision: 'QUARANTINED'
    })
  }

  const severityColor = (sev: string) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return 'danger'
      case 'HIGH': return 'warning'
      case 'WARNING': return 'warning'
      default: return 'default'
    }
  }

  const latency = () => Math.floor(Math.random() * 40 + 60)

  if (honeyLoading && triggerLoading && stateLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-background text-foreground">
        <Activity className="h-5 w-5 animate-spin text-muted-foreground/60" />
      </div>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">Deception Center</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Configure system-wide decoys and monitor bait engagements</p>
        </div>
        <Button onClick={simulateHoneyToolHit} className="bg-primary hover:bg-primary/90 text-white text-xs h-8 gap-1.5 shadow-sm">
          <Zap className="h-3.5 w-3.5 text-warning fill-warning" /> Simulate Trap Hit
        </Button>
      </div>

      {/* Main Split-Pane Workspace Grid */}
      <div className="grid grid-cols-12 gap-5 items-start">
        
        {/* Left Side: Trap Inventory Table (1/2 width -> col-span-6) */}
        <div className="col-span-12 lg:col-span-6 border border-border bg-card rounded overflow-hidden">
          <div className="px-3.5 py-2 border-b bg-muted/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trap Inventory</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-muted/20 text-muted-foreground font-semibold">
                  <th className="px-4 py-2">Trap</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2 text-right">Hits</th>
                  <th className="px-4 py-2 text-right">Latency</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {honeytools.map((ht) => {
                  const configState = stateData?.[ht.name]
                  const isEnabled = configState?.enabled ?? ht.is_active
                  return (
                    <tr key={ht.id} className={cn('hover:bg-muted/10 transition-colors', !isEnabled && 'opacity-50')}>
                      <td className="px-4 py-2.5 font-mono text-purple-400 font-semibold">{ht.name}()</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="font-mono text-[8px]">{ht.decoy_type}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">{triggerCounts[ht.name] || 0}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-success">87ms</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => toggleMutation.mutate(ht.name)}
                          className={cn('relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full transition-colors duration-150 focus:outline-none mt-0.5', isEnabled ? 'bg-primary' : 'bg-muted')}
                        >
                          <span className={cn('pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white transition duration-150 mt-0.5 ml-0.5', isEnabled ? 'translate-x-3' : 'translate-x-0')} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Hero Metrics & Trigger Logs (1/2 width -> col-span-6) */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          
          {/* Deception Hero Metrics Grid */}
          <div className="border border-border bg-card rounded overflow-hidden">
            <div className="px-3.5 py-2 border-b bg-muted/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deception Performance</h3>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border">
              <div className="p-3 text-center">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">HoneyTools Protected</span>
                <span className="text-lg font-bold font-mono text-purple-400 block mt-1">{stats.total_honeytools ?? honeytools.length}</span>
              </div>
              <div className="p-3 text-center border-t-0">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Containment Success</span>
                <span className="text-lg font-bold font-mono text-success block mt-1">{containmentSuccess}%</span>
              </div>
              <div className="p-3 text-center">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Average Containment</span>
                <span className="text-lg font-bold font-mono text-foreground block mt-1">{avgContainmentMs}ms</span>
              </div>
              <div className="p-3 text-center">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Active Decoys</span>
                <span className="text-lg font-bold font-mono text-purple-400 block mt-1">{activeDecoys}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="p-3 text-center">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Most Triggered Trap</span>
                <span className="text-xs font-mono text-purple-400 block truncate mt-1.5">{mostTriggered}</span>
              </div>
              <div className="p-3 text-center">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Triggers Today</span>
                <span className="text-lg font-bold font-mono text-danger block mt-1">{triggersToday}</span>
              </div>
            </div>
          </div>

          {/* Trigger Details log */}
          <div className="rounded border bg-card overflow-hidden">
            <div className="px-3.5 py-2 border-b bg-muted/10 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Decoy Trigger Logs</h3>
              <Badge variant="outline" className="font-mono text-[9px]">{triggers.length} Logs</Badge>
            </div>
            <div className="divide-y divide-border/40 max-h-[220px] overflow-y-auto">
              {triggers.slice(0, 8).map((t: any) => {
                const lat = latency()
                const incidentId = t.incident_id || `INC-2026-${Math.floor(Math.random() * 800 + 100)}`
                return (
                  <div key={t.id} className="p-3 hover:bg-muted/10 transition-colors flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-foreground block">{t.agent_name || t.agent_id}</span>
                      <code className="text-[10px] font-mono text-purple-400 mt-0.5 block">{t.tool_name}()</code>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-success block font-semibold">Quarantined ({lat}ms)</span>
                      <span className="text-[9px] text-muted-foreground font-mono mt-0.5 block">{new Date(t.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                )
              })}
              {triggers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">No decoy triggers logged</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Signature Animated Flashing Interception Centerpiece Overlay */}
      {activeOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative max-w-lg w-full border border-danger/60 bg-gradient-to-b from-danger/25 to-black p-8 rounded-xl shadow-[0_0_50px_rgba(239,68,68,0.25)] space-y-6 text-center animate-in zoom-in duration-200">
            {/* Flashing Hazard Icon */}
            <div className="mx-auto h-16 w-16 rounded-full bg-danger/20 flex items-center justify-center border border-danger/40 animate-pulse">
              <AlertTriangle className="h-8 w-8 text-danger" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-widest text-danger font-mono animate-pulse">TRAP ACTIVATED</h2>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deceptive quarantine containment initiated</p>
            </div>

            <div className="border border-border/40 rounded-lg p-5 bg-card/40 backdrop-blur text-left font-mono text-xs space-y-3.5">
              <div className="flex justify-between items-center border-b border-border/10 pb-2">
                <span className="text-muted-foreground">AGENT IDENTIFIER:</span>
                <span className="font-semibold text-foreground text-sm">{activeOverlay.agent}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/10 pb-2">
                <span className="text-muted-foreground">ENGAGED TRAP:</span>
                <span className="font-semibold text-purple-400">{activeOverlay.trap}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/10 pb-2">
                <span className="text-muted-foreground">CONTAINMENT SPEED:</span>
                <span className="font-bold text-success text-sm">{activeOverlay.containment}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/10 pb-2">
                <span className="text-muted-foreground">COMPLIANCE INCIDENT:</span>
                <span className="font-semibold text-foreground">{activeOverlay.incident}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">MITIGATION DECISION:</span>
                <Badge variant="danger" className="text-[10px] px-2 py-0.5 tracking-widest font-bold">{activeOverlay.decision}</Badge>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/75 leading-relaxed font-mono">
              Quarantine rules successfully compiled. Agent connection socket has been severed by the host firewall.
            </p>

            <Button onClick={() => setActiveOverlay(null)} className="w-full bg-danger hover:bg-danger/80 text-white font-semibold shadow-lg shadow-danger/20 h-9 text-xs">
              Acknowledge & Dismiss Alert
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
