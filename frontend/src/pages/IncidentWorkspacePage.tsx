import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, Shield, FileText, Clock,
  Activity, Ban, Target, Play, Pause, Square,
  RotateCcw, ChevronLeft, ChevronRight, ListTodo, Settings, Search
} from 'lucide-react'
import { api, request } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { useToastStore } from '@/store/toast'
import { cn } from '@/lib/utils'
import type { Incident, ReplayEvent } from '@/types'

type IncidentTab = 'storyline' | 'evidence' | 'actions'
const SPEEDS = [0.5, 1, 2, 5] as const

export function IncidentWorkspacePage() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const [searchParams, setSearchParams] = useSearchParams()
  
  const activeIncidentId = searchParams.get('id') || searchParams.get('incidentId') || searchParams.get('session') || ''
  const queryTab = searchParams.get('tab') as IncidentTab | null
  const activeTab = queryTab || 'storyline'

  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  // Replay tab state
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState<number>(1)
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch incidents list
  const { data: incidents, isLoading } = useQuery<Incident[]>({
    queryKey: ['incidents', severityFilter],
    queryFn: () => request(`/incidents?${severityFilter ? `severity=${severityFilter}` : ''}`),
    refetchInterval: 5000,
  })

  const selectedIncident = useMemo(() => {
    return (incidents || []).find((i) => i.id === activeIncidentId) || null
  }, [incidents, activeIncidentId])

  // Fetch replay events for selected incident
  const { data: replayEvents, isLoading: replayLoading } = useQuery<ReplayEvent[]>({
    queryKey: ['replay-events', activeIncidentId],
    queryFn: () => api.getReplayEvents(activeIncidentId),
    enabled: !!activeIncidentId && activeTab === 'storyline',
  })

  const maxStep = (replayEvents?.length ?? 1) - 1

  // Keep currentStep bound within limits when replayEvents reload
  useEffect(() => {
    if (replayEvents && currentStep > replayEvents.length - 1) {
      setCurrentStep(Math.max(0, replayEvents.length - 1))
    }
  }, [replayEvents, currentStep])

  const stopPlayback = useCallback(() => {
    setIsPlaying(false)
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current)
      playTimerRef.current = null
    }
  }, [])

  const handleStop = useCallback(() => {
    stopPlayback()
    setCurrentStep(0)
  }, [stopPlayback])

  const stepForward = useCallback(() => {
    stopPlayback()
    setCurrentStep((prev) => Math.min(prev + 1, maxStep))
  }, [stopPlayback, maxStep])

  const stepBackward = useCallback(() => {
    stopPlayback()
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }, [stopPlayback])

  // Resolve incident mutation
  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.resolveIncident(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      addToast({ message: 'Incident marked as RESOLVED successfully', variant: 'success' })
    },
    onError: (err: any) => {
      addToast({ message: err?.message || 'Resolution failed', variant: 'error' })
    }
  })

  // Playback timer ticker
  useEffect(() => {
    if (!isPlaying || !replayEvents?.length) return
    const intervalMs = 1500 / replaySpeed
    playTimerRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= replayEvents.length - 1) {
          stopPlayback()
          return prev
        }
        return prev + 1
      })
    }, intervalMs)
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }
  }, [isPlaying, replaySpeed, replayEvents, stopPlayback])

  const filtered = useMemo(() => {
    if (!incidents) return []
    let list = [...incidents]
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      list = list.filter(i => i.agent_name.toLowerCase().includes(q) || i.trigger_reason.toLowerCase().includes(q))
    }
    return list
  }, [incidents, searchTerm])

  const openWorkspacePanel = (incId: string) => {
    setSearchParams({ id: incId, tab: activeTab })
    setCurrentStep(0)
    stopPlayback()
  }

  const setWorkspaceTab = (tab: IncidentTab) => {
    if (activeIncidentId) {
      setSearchParams({ id: activeIncidentId, tab })
    }
  }

  const severityColor = (sev: string) =>
    sev === 'CRITICAL' ? 'danger' : sev === 'HIGH' ? 'warning' : sev === 'MEDIUM' ? 'warning' : 'default' as const

  const getEventStyle = (event: ReplayEvent, active: boolean) => {
    const isCritical = event.event_type === 'honeytool' || event.event_type === 'quarantine' || event.risk_score > 60
    if (active) {
      return isCritical 
        ? 'border-l-2 border-danger bg-danger/10 text-foreground font-semibold' 
        : 'border-l-2 border-primary bg-primary/10 text-foreground font-semibold'
    }
    return 'border-l border-border/40 hover:bg-muted/10 text-muted-foreground'
  }

  return (
    <div className="space-y-4 text-sm">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">Investigation</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Audit compliance incidents, timeline storylines, and containment logs</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
          const a = document.createElement('a')
          a.href = `/api/incidents?export=json${severityFilter ? `&severity=${severityFilter}` : ''}`
          a.download = 'incidents_export.json'; a.click()
        }}>
          <FileText className="h-3.5 w-3.5" /> Export Reports
        </Button>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="grid grid-cols-12 gap-5 items-start">
        {/* Left Side: Incident Queue Table (col-span-4) */}
        <div className="col-span-12 lg:col-span-4 space-y-3.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search incidents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 h-8 rounded border border-border bg-card px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-card border rounded px-1.5 h-8 text-xs focus:ring-1"
            >
              <option value="">All Severity</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div className="rounded border bg-card overflow-hidden">
            <div className="px-3.5 py-2 border-b bg-muted/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Incident Queue</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b bg-muted/20 text-muted-foreground font-semibold">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2">Agent</th>
                    <th className="px-3 py-2">Trigger</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((inc) => {
                    const active = activeIncidentId === inc.id
                    return (
                      <tr
                        key={inc.id}
                        onClick={() => openWorkspacePanel(inc.id)}
                        className={cn(
                          'cursor-pointer hover:bg-muted/10 transition-colors',
                          active && 'bg-primary/5 hover:bg-primary/5'
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <StatusIndicator status={inc.severity === 'CRITICAL' ? 'danger' : inc.severity === 'HIGH' ? 'warning' : 'inactive'} />
                        </td>
                        <td className="px-3 py-2.5 font-medium">{inc.agent_name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[120px]">{inc.trigger_type}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Badge variant={inc.status === 'RESOLVED' ? 'success' : severityColor(inc.severity)} className="text-[8px] font-mono leading-none">
                            {inc.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground">No compliance alerts registered</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Tabbed Details Pane (col-span-8) */}
        <div className="col-span-12 lg:col-span-8 border border-border bg-card rounded overflow-hidden min-h-[580px] flex flex-col">
          {activeIncidentId && selectedIncident ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header Panel */}
              <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/10">
                <div>
                  <h2 className="text-sm font-semibold">Incident Details</h2>
                  <p className="text-[10px] text-muted-foreground font-mono">Agent ID: {selectedIncident.agent_id} | Incident ID: {selectedIncident.id.slice(0, 8)}</p>
                </div>
                {selectedIncident.status !== 'RESOLVED' && (
                  <Button size="sm" className="bg-success hover:bg-success/90 h-7 text-[11px] font-bold text-white shadow-sm" onClick={() => resolveMutation.mutate(selectedIncident.id)}>
                    Resolve Case
                  </Button>
                )}
              </div>

              {/* Workspace Navigation Tabs */}
              <div className="flex border-b px-2 bg-muted/5 text-xs overflow-x-auto">
                {([
                  { id: 'storyline', label: 'Storyline', icon: Clock },
                  { id: 'evidence', label: 'Evidence logs', icon: FileText },
                  { id: 'actions', label: 'Response Actions', icon: ListTodo },
                ] as const).map((t) => {
                  const Icon = t.icon
                  const active = activeTab === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setWorkspaceTab(t.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors whitespace-nowrap',
                        active ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  )
                })}
              </div>

              {/* Detail Contents */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0">
                {activeTab === 'storyline' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* SOC VCR Toolbar Controls */}
                    <div className="flex flex-col gap-2 p-3 rounded border bg-muted/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', isPlaying ? 'bg-danger' : 'bg-muted')} />
                            <span className={cn('relative inline-flex rounded-full h-2 w-2', isPlaying ? 'bg-danger animate-pulse' : 'bg-muted-foreground/60')} />
                          </span>
                          <span className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
                            {isPlaying ? 'PLAYING SURVEILLANCE' : 'SURVEILLANCE PAUSED'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                          STEP {currentStep + 1} OF {(replayEvents?.length || 0)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={() => setCurrentStep(0)} className="h-7 w-7 p-0"><RotateCcw className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={stepBackward} disabled={currentStep === 0} className="h-7 w-7 p-0"><ChevronLeft className="h-3.5 w-3.5" /></Button>
                        {isPlaying ? (
                          <Button variant="ghost" size="sm" onClick={stopPlayback} className="h-7 w-7 p-0 text-warning"><Pause className="h-3.5 w-3.5" /></Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setIsPlaying(true)} disabled={currentStep >= maxStep} className="h-7 w-7 p-0 text-success"><Play className="h-3.5 w-3.5" /></Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={stepForward} disabled={currentStep >= maxStep} className="h-7 w-7 p-0"><ChevronRight className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={handleStop} className="h-7 w-7 p-0 text-muted-foreground"><Square className="h-3.5 w-3.5" /></Button>

                        {/* Slider Timeline Scrubber */}
                        <div className="flex-1 relative flex items-center">
                          <input
                            type="range"
                            min={0}
                            max={maxStep}
                            value={currentStep}
                            onChange={(e) => { stopPlayback(); setCurrentStep(Number(e.target.value)) }}
                            className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer z-10"
                          />
                          {/* Event Timeline Markers */}
                          <div className="absolute inset-0 flex items-center pointer-events-none z-0 px-1">
                            {replayEvents?.map((event, idx) => {
                              const pct = maxStep > 0 ? (idx / maxStep) * 100 : 0
                              const isCritical = event.event_type === 'honeytool' || event.event_type === 'quarantine' || event.risk_score > 60
                              if (!isCritical) return null
                              return (
                                <span
                                  key={event.id}
                                  className={cn(
                                    'absolute w-2 h-2 rounded-full border border-background',
                                    event.event_type === 'honeytool' ? 'bg-purple-500' : 'bg-danger'
                                  )}
                                  style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
                                />
                              )
                            })}
                          </div>
                        </div>

                        {/* Speed controller */}
                        <div className="flex items-center gap-1">
                          {SPEEDS.map((s) => (
                            <button key={s} onClick={() => setReplaySpeed(s)} className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors', replaySpeed === s ? 'bg-primary text-white font-bold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/15')}>
                              {s}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Chronological Incident Storyline List (No Cyberpunk Canvas) */}
                    <div className="border rounded bg-card overflow-hidden">
                      <div className="px-3.5 py-2 border-b bg-muted/10">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Attack Timeline Storyline</h3>
                      </div>
                      <div className="p-3.5 space-y-2">
                        {replayLoading ? (
                          <p className="text-xs text-muted-foreground py-6 text-center">Loading timeline events...</p>
                        ) : replayEvents && replayEvents.length > 0 ? (
                          <div className="space-y-1">
                            {replayEvents.map((event, idx) => {
                              const active = idx === currentStep
                              const date = new Date(event.timestamp)
                              const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              
                              // Map labels
                              let label = event.details || ''
                              if (event.event_type === 'auth') label = 'Agent established connection session'
                              if (event.event_type === 'tool_call') label = `Executed tool call: ${event.tool_name}()`
                              if (event.event_type === 'honeytool') label = `HONEYTOOL TRAP DECOY TRIGGERED: ${event.tool_name}()`
                              if (event.event_type === 'containment') label = `Quarantine containment engine severing sockets`
                              if (event.event_type === 'quarantine') label = `Agent status updated to QUARANTINED`

                              return (
                                <div
                                  key={event.id}
                                  onClick={() => { stopPlayback(); setCurrentStep(idx) }}
                                  className={cn(
                                    'p-2.5 rounded transition-all cursor-pointer flex items-start gap-3',
                                    getEventStyle(event, active)
                                  )}
                                >
                                  <span className="font-mono text-[10px] text-muted-foreground mt-0.5 shrink-0">{timeStr}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium">{label}</p>
                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/80">
                                      <span className="font-mono uppercase tracking-wider">Type: {event.event_type}</span>
                                      {event.risk_score !== undefined && (
                                        <span className={cn('font-mono font-bold', event.risk_score > 70 ? 'text-danger' : 'text-muted-foreground')}>
                                          Risk score: {event.risk_score.toFixed(0)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {event.event_type === 'honeytool' && (
                                    <Badge variant="danger" className="text-[7px] font-mono leading-none tracking-wider shrink-0 animate-pulse">DECOY TRIGGER</Badge>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground py-6 text-center">No timeline events recorded</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'evidence' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="border rounded bg-card overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b bg-muted/20 text-muted-foreground font-semibold">
                            <th className="px-4 py-2">Invoked Tool</th>
                            <th className="px-4 py-2">Trigger Classification</th>
                            <th className="px-4 py-2 text-right">Risk Weight</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {(selectedIncident.tools_invoked || []).map((t: string, i: number) => (
                            <tr key={i} className="hover:bg-muted/10">
                              <td className="px-4 py-2.5 font-mono text-danger font-bold">{t}()</td>
                              <td className="px-4 py-2.5">
                                <Badge variant={selectedIncident.trigger_type === 'honeytool' ? 'danger' : 'warning'} className="text-[8px] font-mono">
                                  {selectedIncident.trigger_type || 'STANDARD'}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-danger font-bold">100</td>
                            </tr>
                          ))}
                          {(selectedIncident.tools_invoked || []).length === 0 && (
                            <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">No evidence logs registered</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="border rounded p-3.5 bg-card">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Technical Trigger Details</h4>
                      <div className="bg-black/40 p-3 rounded border text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                        {selectedIncident.trigger_reason}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'actions' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {selectedIncident.recommended_actions && selectedIncident.recommended_actions.length > 0 && (
                      <div className="rounded border bg-primary/5 border-primary/20 p-3.5">
                        <h4 className="text-xs font-bold text-primary uppercase mb-2">Recommended Response Steps</h4>
                        <ul className="space-y-2 text-xs">
                          {selectedIncident.recommended_actions.map((a: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-muted-foreground">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedIncident.actions_taken && selectedIncident.actions_taken.length > 0 && (
                      <div className="rounded border p-3.5 bg-card">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Automated Incident Containment Logs</h4>
                        <ul className="space-y-2 text-xs">
                          {selectedIncident.actions_taken.map((a: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-muted-foreground">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-danger shrink-0 animate-ping" />
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center p-8">
              <AlertTriangle className="h-10 w-10 mb-3 opacity-20 text-danger" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">No Case Selected</h3>
              <p className="text-xs max-w-xs mt-1">Select an incident alert from the queue registry table to view storylines, audit evidence, and review containment details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
