import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Play, Activity, FlaskConical, RotateCcw, LogOut, Zap,
  Terminal, ShieldAlert, Square, Pause, Download, ChevronRight, FileText
} from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToastStore } from '@/store/toast'
import { subscribe } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'
import type { Agent, ScenarioDefinition, ScenarioState, ReplaySession } from '@/types'

const DEMO_ATTACK_SCENARIOS = [
  { key: 'prompt_injection', label: 'Prompt Injection', desc: 'Agent tricked into executing malicious commands' },
  { key: 'privilege_escalation', label: 'Privilege Escalation', desc: 'Rapid tool chaining to escalate privileges' },
  { key: 'recon_burst', label: 'Recon Burst', desc: 'Burst of reconnaissance activity' },
  { key: 'demo_attack', label: 'HoneyTool Trigger', desc: 'Agent hits a decoy trap and gets contained' },
  { key: 'live_demo', label: 'Live Demo (Director)', desc: 'Cinematic one-click demonstration for presentations' },
]

export function SimulationCenterPage() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const [selectedScenario, setSelectedScenario] = useState(DEMO_ATTACK_SCENARIOS[3].key)
  const [launching, setLaunching] = useState(false)
  const [liveLogs, setLiveLogs] = useState<any[]>([])

  const { data: demoState } = useQuery({
    queryKey: ['demo-state'],
    queryFn: () => api.getDemoState(),
    refetchInterval: 3000,
  })

  const { data: definitions, isLoading: defsLoading } = useQuery<ScenarioDefinition[]>({
    queryKey: ['scenario-definitions'],
    queryFn: () => api.getScenarioDefinitions(),
  })

  const { data: state } = useQuery<ScenarioState>({
    queryKey: ['scenario-state'],
    queryFn: () => api.getScenarioState(),
    refetchInterval: (q) => q.state.data?.status === 'running' || q.state.data?.status === 'paused' ? 1000 : false,
  })

  const { data: replaySessions } = useQuery<ReplaySession[]>({
    queryKey: ['replay-sessions'],
    queryFn: () => api.getReplaySessions(),
  })

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.getAgents(),
    refetchInterval: 5000,
  })

  // Mutations for Scenario Runner
  const startScenarioMutation = useMutation({
    mutationFn: (key: string) => api.startScenario(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenario-state'] })
      addToast({ message: 'Scenario started', variant: 'success' })
    },
  })

  const pauseScenarioMutation = useMutation({
    mutationFn: () => api.pauseScenario(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenario-state'] }),
  })

  const stopScenarioMutation = useMutation({
    mutationFn: () => api.stopScenario(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenario-state'] }),
  })

  const resetScenarioMutation = useMutation({
    mutationFn: () => api.resetScenario(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenario-state'] }),
  })

  // Mutations for Demo Sandboxed Environment
  const enterDemoMutation = useMutation({
    mutationFn: () => api.enterDemoEnvironment(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo-state'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      addToast({ message: 'Demo environment activated with fresh seed data', variant: 'success' })
    },
    onError: (e: Error) => addToast({ message: e.message, variant: 'error' }),
  })

  const exitDemoMutation = useMutation({
    mutationFn: () => api.exitDemoEnvironment(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo-state'] })
      addToast({ message: 'Exited demo environment', variant: 'warning' })
    },
  })

  const resetDemoMutation = useMutation({
    mutationFn: () => api.resetDemoEnvironment(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo-state'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      addToast({ message: 'Demo environment reset', variant: 'success' })
    },
    onError: (e: Error) => addToast({ message: e.message, variant: 'error' }),
  })

  const launchDemoScenario = async () => {
    if (!demoState?.is_active) {
      addToast({ message: 'Enter demo environment first', variant: 'warning' })
      return
    }
    setLaunching(true)
    try {
      await api.launchDemoScenario(selectedScenario)
      addToast({ message: `Launched: ${selectedScenario}`, variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['demo-state'] })
    } catch (e: any) {
      addToast({ message: e.message || 'Launch failed', variant: 'error' })
    } finally {
      setLaunching(false)
    }
  }

  // Subscribe to live logs
  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      const data = msg.data || msg
      const type = msg.type || data.type || ''
      if (type === 'tool_execution' || data.tool_name) {
        setLiveLogs((prev) => [...prev, {
          id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toLocaleTimeString(),
          agent_name: data.agent_name || 'Agent',
          tool_name: data.tool_name || 'tool_call',
          decision: data.decision || 'ALLOWED',
          risk_score: data.risk_score || 0
        }].slice(-100))
      }
    })
    return () => unsubscribe()
  }, [])

  const exportReplay = async (sessionId: string, format: 'json' | 'csv') => {
    try {
      const blob = await api.exportReplay(sessionId, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `replay_${sessionId}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      addToast({ message: `Exported replay as ${format.toUpperCase()}`, variant: 'success' })
    } catch {
      addToast({ message: 'Export failed', variant: 'error' })
    }
  }

  const isDemoActive = demoState?.is_active ?? false
  const isScenarioRunning = state?.status === 'running'
  const isScenarioPaused = state?.status === 'paused'
  const activeScenarioKey = state?.scenario_key

  if (defsLoading) {
    return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-5 w-5 animate-spin text-muted-foreground/60" /></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Simulation Center" description="Orchestrate security testing scenarios, manage replay compliance data, and view real-time log execution feeds." />

      {/* Demo Sandbox Controls */}
      <div className={cn('rounded-xl border p-5 transition-colors', isDemoActive ? 'border-success/40 bg-success/[0.02]' : 'border-border bg-card')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FlaskConical className={cn('h-6 w-6', isDemoActive ? 'text-success' : 'text-muted-foreground')} />
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                Presentation Sandbox Mode
                <Badge variant={isDemoActive ? 'success' : 'outline'} className="text-[9px]">
                  {isDemoActive ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isDemoActive ? 'Demo mode is active. Fleet database is isolated for safe presentation testing.' : 'Activate presentation mode to isolate active database data.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isDemoActive ? (
              <Button onClick={() => enterDemoMutation.mutate()} disabled={enterDemoMutation.isPending} className="gap-2">
                <FlaskConical className="h-4 w-4" /> {enterDemoMutation.isPending ? 'Entering...' : 'Activate Presentation Mode'}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => resetDemoMutation.mutate()} disabled={resetDemoMutation.isPending} className="gap-2">
                  <RotateCcw className={cn('h-4 w-4', resetDemoMutation.isPending && 'animate-spin')} /> Reset Data
                </Button>
                <Button variant="ghost" onClick={() => exitDemoMutation.mutate()} disabled={exitDemoMutation.isPending} className="gap-2">
                  <LogOut className="h-4 w-4" /> Deactivate
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Scenario launcher panel */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Active Runner Control Panel */}
          {(isScenarioRunning || isScenarioPaused) && (
            <Card className="p-4 border-primary/40 bg-primary/[0.02] shadow-sm animate-in slide-in-from-top-2">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Activity className={cn('h-4 w-4 text-primary', isScenarioRunning && 'animate-pulse')} />
                  <span className="font-semibold text-sm">{activeScenarioKey ? definitions?.find(d => d.key === activeScenarioKey)?.name || activeScenarioKey : 'Scenario'}</span>
                  <Badge variant={isScenarioRunning ? 'success' : 'warning'} className="text-[9px]">{isScenarioRunning ? 'RUNNING' : 'PAUSED'}</Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Step {Math.min(state?.current_step ?? 0, state?.total_steps ?? 0)}/{state?.total_steps}</span>
                  <span className="mx-1 opacity-40">|</span>
                  <span>{state?.elapsed_seconds?.toFixed(1)}s</span>
                  <span className="mx-1 opacity-40">|</span>
                  <span className="truncate max-w-[200px]">{state?.current_label}</span>
                </div>
                <div className="ml-auto flex gap-2">
                  {isScenarioRunning && (
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => pauseScenarioMutation.mutate()}>
                      <Pause className="h-3 w-3" /> Pause
                    </Button>
                  )}
                  {isScenarioPaused && (
                    <Button size="sm" variant="default" className="gap-1 h-7 text-xs" onClick={() => startScenarioMutation.mutate(activeScenarioKey!)}>
                      <Play className="h-3 w-3" /> Resume
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs text-danger hover:text-danger hover:bg-danger/5" onClick={() => stopScenarioMutation.mutate()}>
                    <Square className="h-3 w-3" /> Stop
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => resetScenarioMutation.mutate()}>
                    <RotateCcw className="h-3 w-3" /> Reset
                  </Button>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${state?.total_steps ? ((Math.min(state.current_step, state.total_steps)) / state.total_steps) * 100 : 0}%` }} />
              </div>
            </Card>
          )}

          {/* Scenarios definitions list */}
          <div className="grid gap-4 sm:grid-cols-2">
            {definitions?.map((def) => {
              const disabled = isScenarioRunning || startScenarioMutation.isPending
              const isActive = activeScenarioKey === def.key && (isScenarioRunning || isScenarioPaused)
              return (
                <Card key={def.key} className={cn('p-4 hover:border-primary/30 transition-all', isActive ? 'ring-1 ring-primary' : '')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{def.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{def.description}</p>
                    </div>
                    <Badge variant={def.severity === 'CRITICAL' ? 'danger' : def.severity === 'HIGH' ? 'warning' : 'outline'} className="shrink-0 text-[8px]">{def.severity}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono"><Terminal className="h-3 w-3" /> {def.type.toLowerCase().replace(/_/g, ' ')}</span>
                    <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {def.steps} Steps</span>
                  </div>
                  <div className="mt-4">
                    <Button
                      size="sm"
                      variant={isActive ? 'outline' : 'default'}
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        if (isActive && isScenarioPaused) startScenarioMutation.mutate(def.key)
                        else if (isActive) pauseScenarioMutation.mutate()
                        else startScenarioMutation.mutate(def.key)
                      }}
                      disabled={(!isActive && disabled) || startScenarioMutation.isPending}
                    >
                      {isActive && isScenarioRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {isActive && isScenarioRunning ? 'Pause' : isActive && isScenarioPaused ? 'Resume' : 'Run Scenario'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Live log feed stream for verification */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-3 py-2.5 border-b bg-muted/20 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Terminal className="h-4 w-4" /> Live Simulation Feed</h3>
              <Button variant="ghost" size="sm" onClick={() => setLiveLogs([])} className="h-6 text-[10px] px-1.5">Clear</Button>
            </div>
            <div className="bg-black/60 p-3 h-[250px] overflow-y-auto font-mono text-[10px] space-y-1.5">
              {liveLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-center"><p className="text-caption">Logs will stream here in real-time when scenarios execute</p></div>
              ) : liveLogs.map((log) => (
                <div key={log.id} className="flex justify-between gap-2 border-b border-border/10 pb-1">
                  <span className="truncate flex-1 text-muted-foreground">[{log.timestamp}] <span className="font-semibold text-primary">{log.agent_name}</span>: {log.tool_name}()</span>
                  <span className={cn('font-semibold shrink-0', log.decision === 'ALLOWED' ? 'text-success' : 'text-danger')}>{log.decision}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Replay Compliance exporter */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-3 py-2.5 border-b bg-muted/20"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Download className="h-4 w-4" /> Export Replay Session Data</h3></div>
            <div className="p-3 max-h-[220px] overflow-y-auto space-y-2">
              {replaySessions?.map((s) => (
                <div key={s.session_id} className="flex items-center justify-between text-xs p-2 rounded border bg-muted/10">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-semibold truncate">{s.agent_name || 'Agent Replay'}</p>
                    <p className="text-[10px] text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleString() : 'N/A'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => exportReplay(s.session_id, 'json')}>JSON</Button>
                    <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => exportReplay(s.session_id, 'csv')}>CSV</Button>
                  </div>
                </div>
              ))}
              {(!replaySessions || replaySessions.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">No replay sessions recorded</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
