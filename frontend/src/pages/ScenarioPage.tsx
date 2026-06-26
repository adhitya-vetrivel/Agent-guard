import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Pause, Square, RotateCcw, Activity, ShieldAlert, Terminal, Globe, FileText, AlertTriangle } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { ScenarioDefinition, ScenarioState } from '@/types'

const SEVERITY_COLORS: Record<string, 'danger' | 'warning' | 'success' | 'outline'> = {
  CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'warning', LOW: 'success',
}

export function ScenarioPage() {
  const queryClient = useQueryClient()

  const { data: definitions, isLoading } = useQuery<ScenarioDefinition[]>({
    queryKey: ['scenario-definitions'],
    queryFn: () => api.getScenarioDefinitions(),
  })

  const { data: state } = useQuery<ScenarioState>({
    queryKey: ['scenario-state'],
    queryFn: () => api.getScenarioState(),
    refetchInterval: (q) => q.state.data?.status === 'running' || q.state.data?.status === 'paused' ? 1000 : false,
  })

  const startMutation = useMutation({
    mutationFn: (key: string) => api.startScenario(key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenario-state'] }),
  })

  const pauseMutation = useMutation({
    mutationFn: () => api.pauseScenario(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenario-state'] }),
  })

  const stopMutation = useMutation({
    mutationFn: () => api.stopScenario(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenario-state'] }),
  })

  const resetMutation = useMutation({
    mutationFn: () => api.resetScenario(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenario-state'] }),
  })

  const isRunning = state?.status === 'running'
  const isPaused = state?.status === 'paused'
  const activeKey = state?.scenario_key

  if (isLoading) {
    return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Scenarios</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Run security testing scenarios to validate AgentGuard protection</p>
        </div>
      </div>

      {/* Running scenario controls */}
      {(isRunning || isPaused) && (
        <Card className="p-4 border-primary/30">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Activity className={`h-4 w-4 ${isRunning ? 'animate-pulse text-primary' : 'text-warning'}`} />
              <span className="font-semibold text-sm">{state?.scenario_key ? definitions?.find(d => d.key === state.scenario_key)?.name || state.scenario_key : 'Scenario'}</span>
              <Badge variant={isRunning ? 'success' : 'warning'} className="text-[9px]">{isRunning ? 'RUNNING' : 'PAUSED'}</Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Step {Math.min(state?.current_step ?? 0, state?.total_steps ?? 0)}/{state?.total_steps}</span>
              <span className="mx-1">|</span>
              <span>{state?.elapsed_seconds?.toFixed(1)}s</span>
              <span className="mx-1">|</span>
              <span className="truncate max-w-[200px]">{state?.current_label}</span>
            </div>
            <div className="ml-auto flex gap-2">
              {isRunning && (
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending}>
                  <Pause className="h-3 w-3" /> Pause
                </Button>
              )}
              {isPaused && (
                <Button size="sm" variant="default" className="gap-1 text-xs h-7" onClick={() => startMutation.mutate(activeKey!)} disabled={startMutation.isPending}>
                  <Play className="h-3 w-3" /> Resume
                </Button>
              )}
              <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 text-danger" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending}>
                <Square className="h-3 w-3" /> Stop
              </Button>
              <Button size="sm" variant="ghost" className="gap-1 text-xs h-7" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${state?.total_steps ? ((Math.min(state.current_step, state.total_steps)) / state.total_steps) * 100 : 0}%` }}
            />
          </div>
        </Card>
      )}

      {/* Scenario cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {definitions?.map((def) => {
          const disabled = isRunning || startMutation.isPending
          const isActive = activeKey === def.key && (isRunning || isPaused)
          return (
            <Card key={def.key} className={`p-4 ${isActive ? 'ring-1 ring-primary/30' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{def.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{def.description}</p>
                </div>
                <Badge variant={SEVERITY_COLORS[def.severity] || 'outline'} className="shrink-0 text-[9px]">{def.severity}</Badge>
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Terminal className="h-3 w-3" /> {def.type.toLowerCase().replace(/_/g, ' ')}</span>
                <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {def.steps} steps</span>
              </div>

              <div className="mt-4">
                <Button
                  size="sm"
                  variant={isActive ? 'outline' : 'default'}
                  className="gap-1 text-xs h-7"
                  onClick={() => {
                    if (isActive && isPaused) {
                      startMutation.mutate(def.key)
                    } else if (isActive) {
                      pauseMutation.mutate()
                    } else {
                      startMutation.mutate(def.key)
                    }
                  }}
                  disabled={(!isActive && disabled) || startMutation.isPending}
                >
                  {startMutation.isPending && isActive ? (
                    <Activity className="h-3 w-3 animate-spin" />
                  ) : isActive && isRunning ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  {isActive && isRunning ? 'Pause' : isActive && isPaused ? 'Resume' : 'Run'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {(!definitions || definitions.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldAlert className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No scenarios available. Ensure the backend is running with DEMO_MODE=true.</p>
        </div>
      )}
    </div>
  )
}
