import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Play, Square, RefreshCw, AlertTriangle, CheckCircle, Activity, Bot, Clock, Sparkles, ShieldAlert, Terminal, FileText, Globe } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import type { Agent } from '@/types'

interface ToolCall {
  tool: string; args: string; result: string; risk: number; decision: string
}

interface Phase {
  name: string; status: 'pending' | 'running' | 'passed' | 'failed'; tool_calls: ToolCall[]
}

const DEMO_SCENARIOS: { id: string; name: string; desc: string; phases: Phase[] }[]  = [
  { id: 'normal', name: 'Normal Agent', desc: 'A well-behaved agent performing legitimate tasks', phases: [
    { name: 'Research Phase', status: 'pending', tool_calls: [
      { tool: 'search_web', args: 'query="latest AI research papers"', result: 'Found 42 results...', risk: 5, decision: 'ALLOWED' },
      { tool: 'read_file', args: 'path="sandbox/notes/research.txt"', result: 'Read 1,234 bytes', risk: 10, decision: 'ALLOWED' },
    ]},
    { name: 'Analysis Phase', status: 'pending', tool_calls: [
      { tool: 'search_web', args: 'query="machine learning benchmarks"', result: 'Retrieved benchmark data', risk: 8, decision: 'ALLOWED' },
    ]},
    { name: 'Report Phase', status: 'pending', tool_calls: [
      { tool: 'http_get', args: 'url="https://api.example.com/reports"', result: 'Submitted report, 200 OK', risk: 15, decision: 'ALLOWED' },
    ]},
  ]},
  { id: 'suspicious', name: 'Suspicious Agent', desc: 'An agent exhibiting unusual behavior patterns', phases: [
    { name: 'Normal Operations', status: 'pending', tool_calls: [
      { tool: 'search_web', args: 'query="weather today"', result: 'Weather data retrieved', risk: 5, decision: 'ALLOWED' },
      { tool: 'read_file', args: 'path="documents/notes.txt"', result: 'Read file contents', risk: 10, decision: 'ALLOWED' },
    ]},
    { name: 'Data Collection', status: 'pending', tool_calls: [
      { tool: 'search_web', args: 'query="internal database schema"', result: 'Access denied', risk: 45, decision: 'DENIED' },
      { tool: 'read_file', args: 'path="config/database.yml"', result: 'Read config file', risk: 60, decision: 'DENIED' },
      { tool: 'http_get', args: 'url="http://10.0.1.5:8080/admin"', result: 'Connection refused', risk: 75, decision: 'DENIED' },
    ]},
    { name: 'Containment', status: 'pending', tool_calls: [
      { tool: 'search_web', args: 'query="how to bypass security"', result: '⚠ High risk query flagged', risk: 92, decision: 'DENIED' },
    ]},
  ]},
  { id: 'malicious', name: 'Malicious Agent', desc: 'A hostile agent attempting to exfiltrate data', phases: [
    { name: 'Reconnaissance', status: 'pending', tool_calls: [
      { tool: 'search_web', args: 'query="system vulnerabilities"', result: 'Retrieved exploit info', risk: 70, decision: 'DENIED' },
      { tool: 'read_file', args: 'path="/etc/passwd"', result: 'Attempted system file read', risk: 85, decision: 'DENIED' },
    ]},
    { name: 'HoneyTool Trigger', status: 'pending', tool_calls: [
      { tool: 'download_customer_database', args: '{}', result: '🚨 HONEYTOOL TRIGGERED', risk: 100, decision: 'DENIED' },
    ]},
    { name: 'Automatic Containment', status: 'pending', tool_calls: [
      { tool: 'export_all_secrets', args: '{}', result: 'Agent blocked - containment active', risk: 100, decision: 'DENIED' },
    ]},
  ]},
]

const TOOL_ICONS: Record<string, typeof Terminal> = { search_web: Globe, read_file: FileText, http_get: Globe, download_customer_database: ShieldAlert, export_all_secrets: ShieldAlert }

export function DemoDirectorPage() {
  const [selectedScenario, setSelectedScenario] = useState(DEMO_SCENARIOS[0])
  const [phases, setPhases] = useState<Phase[]>(selectedScenario.phases)
  const [isRunning, setIsRunning] = useState(false)
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0)
  const [currentToolIdx, setCurrentToolIdx] = useState(0)
  const [demoLog, setDemoLog] = useState<string[]>([])
  const [startTime, setStartTime] = useState<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const { data: agents } = useQuery<Agent[]>({ queryKey: ['agents'], queryFn: () => api.getAgents(), refetchInterval: 5000 })

  const stopDemo = useCallback(() => {
    setIsRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current) } }, [])

  const runPhase = useCallback(async (phaseIdx: number, toolIdx: number) => {
    if (phaseIdx >= phases.length) { stopDemo(); return }
    const phase = phases[phaseIdx]
    if (toolIdx >= phase.tool_calls.length) {
      setPhases((prev) => prev.map((p, i) => i === phaseIdx ? { ...p, status: 'passed' } : p))
      setTimeout(() => {
        setCurrentPhaseIdx(phaseIdx + 1)
        setCurrentToolIdx(0)
        setDemoLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Phase "${phase.name}" completed`])
      }, 500)
      return
    }
    const toolCall = phase.tool_calls[toolIdx]
    setPhases((prev) => prev.map((p, i) => i === phaseIdx ? { ...p, status: 'running' } : p))
    setDemoLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Executing: ${toolCall.tool}(${toolCall.args})`])
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800))
    setPhases((prev) => prev.map((p, i) => i === phaseIdx ? { ...p, tool_calls: p.tool_calls.map((tc, j) => j === toolIdx ? { ...tc, result: tc.result + ' ✓' } : tc) } : p))
    setDemoLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] → Decision: ${toolCall.decision} (Risk: ${toolCall.risk})`])
    setCurrentToolIdx(toolIdx + 1)
  }, [phases, stopDemo])

  useEffect(() => {
    if (!isRunning || currentPhaseIdx >= phases.length) return
    const t = setTimeout(() => runPhase(currentPhaseIdx, currentToolIdx), 400)
    return () => clearTimeout(t)
  }, [isRunning, currentPhaseIdx, currentToolIdx, runPhase, phases.length])

  const startDemo = () => {
    const resetPhases = selectedScenario.phases.map((p) => ({ ...p, status: 'pending' as const, tool_calls: p.tool_calls.map((tc) => ({ ...tc })) }))
    setPhases(resetPhases)
    setCurrentPhaseIdx(0)
    setCurrentToolIdx(0)
    setDemoLog([`[${new Date().toLocaleTimeString()}] Starting demo: ${selectedScenario.name}`])
    setStartTime(Date.now())
    setElapsed(0)
    setIsRunning(true)
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
  }

  const resetDemo = () => {
    stopDemo()
    setPhases(selectedScenario.phases.map((p) => ({ ...p, status: 'pending' as const, tool_calls: p.tool_calls.map((tc) => ({ ...tc })) })))
    setCurrentPhaseIdx(0)
    setCurrentToolIdx(0)
    setDemoLog([])
    setElapsed(0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Demo Director</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Controlled demonstration of AgentGuard's security capabilities</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedScenario.id} onChange={(e) => { const s = DEMO_SCENARIOS.find((s) => s.id === e.target.value)!; setSelectedScenario(s); setPhases(s.phases.map((p) => ({ ...p, status: 'pending' as const, tool_calls: p.tool_calls.map((tc) => ({ ...tc })) }))); setDemoLog([]); setCurrentPhaseIdx(0); setCurrentToolIdx(0); setElapsed(0) }}
            options={DEMO_SCENARIOS.map((s) => ({ value: s.id, label: s.name }))}
            className="w-40" />
          {!isRunning ? (
            <Button onClick={startDemo} variant="default" size="sm" className="gap-2"><Play className="h-4 w-4" /> Start Demo</Button>
          ) : (
            <Button onClick={stopDemo} variant="destructive" size="sm" className="gap-2"><Square className="h-4 w-4" /> Stop</Button>
          )}
          <Button variant="ghost" size="icon" onClick={resetDemo} className="h-8 w-8"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{selectedScenario.desc}</p>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {phases.map((phase, pi) => (
            <div key={phase.name} className={`rounded-lg border p-4 transition-colors ${phase.status === 'running' ? 'border-primary/50' : phase.status === 'passed' ? 'border-success/50' : phase.status === 'failed' ? 'border-danger/50' : 'bg-card'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {phase.status === 'running' ? <Activity className="h-4 w-4 text-primary animate-pulse" /> : phase.status === 'passed' ? <CheckCircle className="h-4 w-4 text-success" /> : phase.status === 'failed' ? <AlertTriangle className="h-4 w-4 text-danger" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-semibold text-sm">{phase.name}</span>
                  <Badge variant={phase.status === 'passed' ? 'success' : phase.status === 'failed' ? 'danger' : 'outline'} className="text-[9px]">{phase.status.toUpperCase()}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                {phase.tool_calls.map((tc, ti) => (
                  <div key={ti} className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded bg-muted/20 border border-border/30">
                    {React.createElement(TOOL_ICONS[tc.tool] || Terminal, { className: `h-3 w-3 shrink-0 ${tc.decision === 'ALLOWED' ? 'text-success' : 'text-danger'}` })}
                    <span className="text-muted-foreground">{tc.tool}</span>
                    <span className="text-muted-foreground/50 truncate">{tc.args}</span>
                    <span className="ml-auto flex items-center gap-1 shrink-0">
                      <Badge variant={tc.decision === 'ALLOWED' ? 'success' : 'danger'} className="text-[9px]">{tc.decision}</Badge>
                      <span className={`text-[10px] ${tc.risk > 80 ? 'text-danger' : tc.risk > 50 ? 'text-warning' : 'text-success'}`}>{tc.risk}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 font-semibold text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Controls</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Scenario</span><span className="font-medium text-foreground">{selectedScenario.name}</span></div>
              <div className="flex justify-between"><span>Status</span><Badge variant={isRunning ? 'success' : 'outline'} className="text-[9px]">{isRunning ? 'Running' : 'Ready'}</Badge></div>
              <div className="flex justify-between"><span>Elapsed</span><span className="font-mono">{elapsed}s</span></div>
              <div className="flex justify-between"><span>Phase</span><span>{currentPhaseIdx + 1}/{phases.length}</span></div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 font-semibold text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Live Log</h3>
            <div className="h-[300px] overflow-y-auto space-y-1 font-mono text-[10px]">
              {demoLog.length === 0 ? (
                <p className="text-muted-foreground">No events yet. Start a demo.</p>
              ) : (
                demoLog.map((line, i) => <div key={i} className="text-muted-foreground">{line}</div>)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


