import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Play, Activity, FlaskConical, RotateCcw, LogOut, Zap,
} from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToastStore } from '@/store/toast'
import { cn } from '@/lib/utils'
import type { Agent, ScenarioDefinition } from '@/types'

const DEMO_ATTACK_SCENARIOS = [
  { key: 'prompt_injection', label: 'Prompt Injection', desc: 'Agent tricked into executing malicious commands' },
  { key: 'privilege_escalation', label: 'Privilege Escalation', desc: 'Rapid tool chaining to escalate privileges' },
  { key: 'recon_burst', label: 'Recon Burst', desc: 'Burst of reconnaissance activity' },
  { key: 'demo_attack', label: 'HoneyTool Trigger', desc: 'Agent hits a decoy trap and gets contained' },
  { key: 'demo_attack', label: 'Compromised Research Agent', desc: 'Full attack lifecycle ending in honeytool containment' },
  { key: 'live_demo', label: 'Live Demo (Director)', desc: 'Cinematic one-click demonstration for presentations' },
]

export function DemoDirectorPage() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const [selectedScenario, setSelectedScenario] = useState(DEMO_ATTACK_SCENARIOS[4].key)
  const [launching, setLaunching] = useState(false)

  const { data: demoState, refetch: refetchDemo } = useQuery({
    queryKey: ['demo-state'],
    queryFn: () => api.getDemoState(),
    refetchInterval: 3000,
  })

  const { data: scenarioDefs } = useQuery({
    queryKey: ['scenario-definitions'],
    queryFn: () => api.getScenarioDefinitions(),
  })

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.getAgents(),
    refetchInterval: 5000,
  })

  const enterMutation = useMutation({
    mutationFn: () => api.enterDemoEnvironment(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo-state'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      addToast({ message: 'Demo environment activated with fresh seed data', variant: 'success' })
    },
    onError: (e: Error) => addToast({ message: e.message, variant: 'error' }),
  })

  const exitMutation = useMutation({
    mutationFn: () => api.exitDemoEnvironment(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo-state'] })
      addToast({ message: 'Exited demo environment', variant: 'warning' })
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => api.resetDemoEnvironment(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo-state'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      addToast({ message: 'Demo environment reset', variant: 'success' })
    },
    onError: (e: Error) => addToast({ message: e.message, variant: 'error' }),
  })

  const launchScenario = async () => {
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

  const isActive = demoState?.is_active ?? false
  const runner = demoState?.runner
  const demoAgents = (agents || []).filter((a) => a.is_demo)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo Director"
        description="Safe live demos with isolated, resettable, deterministic data"
      />

      {/* Demo Environment controls */}
      <div className={cn(
        'rounded-xl border p-5 transition-colors',
        isActive ? 'border-success/40 bg-success/[0.04]' : 'border-border bg-card'
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FlaskConical className={cn('h-6 w-6', isActive ? 'text-success' : 'text-muted-foreground')} />
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                Demo Environment
                <Badge variant={isActive ? 'success' : 'outline'} className="text-[9px]">
                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isActive
                  ? 'Isolated sandbox with fake agents, incidents, and telemetry'
                  : 'Enter to create a safe demo sandbox isolated from production data'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isActive ? (
              <Button
                onClick={() => enterMutation.mutate()}
                disabled={enterMutation.isPending}
                className="gap-2"
              >
                <FlaskConical className="h-4 w-4" />
                {enterMutation.isPending ? 'Entering...' : 'Enter Demo Environment'}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending || demoState?.status === 'resetting'}
                  className="gap-2"
                >
                  <RotateCcw className={cn('h-4 w-4', resetMutation.isPending && 'animate-spin')} />
                  Reset Demo Environment
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => exitMutation.mutate()}
                  disabled={exitMutation.isPending}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" /> Exit
                </Button>
              </>
            )}
          </div>
        </div>

        {isActive && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded bg-muted/30 p-3">
              <p className="text-caption text-muted-foreground">Demo Agents</p>
              <p className="text-xl font-bold tabular-nums">{demoAgents.length}</p>
            </div>
            <div className="rounded bg-muted/30 p-3">
              <p className="text-caption text-muted-foreground">Status</p>
              <p className="text-sm font-medium capitalize">{demoState?.status || 'idle'}</p>
            </div>
            <div className="rounded bg-muted/30 p-3">
              <p className="text-caption text-muted-foreground">Current Scenario</p>
              <p className="text-sm font-mono truncate">{demoState?.current_scenario || '—'}</p>
            </div>
            <div className="rounded bg-muted/30 p-3">
              <p className="text-caption text-muted-foreground">Runner Step</p>
              <p className="text-sm font-mono">
                {runner ? `${runner.current_step}/${runner.total_steps}` : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Attack Scenario Selector */}
      <div className="rounded-md border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Zap className="h-4 w-4 text-warning" /> Attack Scenario Selector
        </h3>
        <p className="text-xs text-muted-foreground mb-4">One-click launch of deterministic attack scenarios</p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {DEMO_ATTACK_SCENARIOS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSelectedScenario(s.key)}
              className={cn(
                'text-left rounded-lg border p-3 transition-colors',
                selectedScenario === s.key
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30 hover:bg-muted/20'
              )}
            >
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>

        <Button
          onClick={launchScenario}
          disabled={!isActive || launching}
          className="gap-2"
          size="lg"
        >
          <Play className="h-4 w-4" />
          {launching ? 'Launching...' : 'One-Click Launch'}
        </Button>
        {!isActive && (
          <p className="text-xs text-warning mt-2">Enter demo environment before launching scenarios</p>
        )}
      </div>

      {/* Scenario runner status */}
      {runner && runner.status === 'running' && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm font-medium">Scenario Running: {runner.scenario_key}</span>
          </div>
          <p className="text-xs text-muted-foreground">{runner.current_label}</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${runner.total_steps ? (runner.current_step / runner.total_steps) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Available scenario definitions from backend */}
      {scenarioDefs && scenarioDefs.length > 0 && (
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-medium">Available Scenarios</h3>
          </div>
          <div className="divide-y divide-border/50">
            {(scenarioDefs as ScenarioDefinition[]).map((def) => (
              <div key={def.key} className="px-3 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{def.name}</p>
                  <p className="text-xs text-muted-foreground">{def.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[8px]">{def.steps} steps</Badge>
                  <Badge variant={def.severity === 'CRITICAL' ? 'danger' : 'warning'} className="text-[8px]">{def.severity}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo agents preview */}
      {isActive && demoAgents.length > 0 && (
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-sm font-medium">Demo Agent Fleet</h3>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {demoAgents.map((agent) => (
              <div key={agent.id} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{agent.name}</span>
                  <Badge variant={agent.status === 'QUARANTINED' ? 'danger' : agent.status === 'BLOCKED' ? 'warning' : 'success'} className="text-[8px]">
                    {agent.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{agent.role}</p>
                <p className="text-xs font-mono tabular-nums mt-1">Risk: {agent.risk_score.toFixed(0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
