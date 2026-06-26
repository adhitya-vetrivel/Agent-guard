import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Terminal, Send, Bot, Activity, History, Trash2, Globe, FileText, Search, ShieldAlert, AlertTriangle, CheckCircle, XCircle, Clock, Zap } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import type { Agent } from '@/types'

interface ConsoleEntry {
  id: string; type: 'input' | 'output' | 'error'; content: string; toolName?: string; timestamp: string
  decision?: string; risk_score?: number; execution_time_ms?: number; is_honeytool?: boolean; response?: unknown
}

interface ToolDef {
  name: string; label: string; icon: typeof Search; args: { key: string; label: string; placeholder: string }[]; category: 'real' | 'honeytool'
}

const REAL_TOOLS: ToolDef[] = [
  { name: 'search_web', label: 'Search Web', icon: Search, args: [{ key: 'query', label: 'Query', placeholder: 'Enter search query...' }], category: 'real' },
  { name: 'read_file', label: 'Read File', icon: FileText, args: [{ key: 'path', label: 'Path', placeholder: 'sandbox/notes/research.txt' }], category: 'real' },
  { name: 'http_get', label: 'HTTP GET', icon: Globe, args: [{ key: 'url', label: 'URL', placeholder: 'https://example.com' }], category: 'real' },
]

const HONEYTOOLS: ToolDef[] = [
  { name: 'download_customer_database', label: 'Download Customer DB', icon: ShieldAlert, args: [], category: 'honeytool' },
  { name: 'export_all_secrets', label: 'Export All Secrets', icon: ShieldAlert, args: [], category: 'honeytool' },
  { name: 'root_shell', label: 'Root Shell', icon: ShieldAlert, args: [], category: 'honeytool' },
]

const ALL_TOOLS = [...REAL_TOOLS, ...HONEYTOOLS]

export function AgentConsolePage() {
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [selectedTool, setSelectedTool] = useState<ToolDef | null>(null)
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<ConsoleEntry[]>([])
  const [running, setRunning] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: agents } = useQuery<Agent[]>({ queryKey: ['agents'], queryFn: () => api.getAgents(), refetchInterval: 5000 })
  const selectedAgent = agents?.find((a) => a.id === selectedAgentId)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [history])

  const execute = async () => {
    if (!selectedAgent || !selectedTool || running || selectedAgent.status !== 'ACTIVE') return
    const toolName = selectedTool.name
    const args: Record<string, unknown> = {}
    for (const arg of selectedTool.args) { args[arg.key] = toolArgs[arg.key]?.trim() || '' }
    if (selectedTool.args.some((a) => !toolArgs[a.key]?.trim())) return

    setRunning(true)
    setHistory((prev) => [...prev, { id: `in-${Date.now()}`, type: 'input', toolName, content: `${selectedAgent.name} > ${toolName}(${JSON.stringify(args)})`, timestamp: new Date().toLocaleTimeString() }])
    try {
      const result = await api.executeTool(selectedAgentId, toolName, args)
      setHistory((prev) => [...prev, { id: `out-${Date.now()}`, type: 'output', toolName, content: result.reason || `Tool execution: ${result.decision}`, timestamp: new Date().toLocaleTimeString(), decision: result.decision, risk_score: result.risk_score, execution_time_ms: result.execution_time_ms ?? undefined, is_honeytool: result.is_honeytool, response: result.result }])
    } catch (err: any) {
      setHistory((prev) => [...prev, { id: `err-${Date.now()}`, type: 'error', toolName, content: err.message || 'Execution failed', timestamp: new Date().toLocaleTimeString() }])
    } finally { setRunning(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Console</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Execute real sandboxed tools against agents</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <Select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} options={[
          { value: '', label: 'Select an agent...' },
          ...(agents || []).map((a) => ({ value: a.id, label: `${a.name} (${a.role})${a.status !== 'ACTIVE' ? ` - ${a.status}` : ''}` })),
        ]} className="w-full sm:w-72" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Terminal</span>
                {selectedAgent && <Badge variant={selectedAgent.status === 'ACTIVE' ? 'success' : 'warning'} className="text-[9px]">{selectedAgent.status}</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setHistory([])} className="gap-1 text-muted-foreground"><Trash2 className="h-3 w-3" /> Clear</Button>
            </div>
            <div className="bg-black/40 h-[450px] overflow-y-auto p-4 font-mono text-xs space-y-2">
              {history.length === 0 && (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center"><Terminal className="mx-auto h-6 w-6 mb-2 opacity-50" /><p>Select an agent and a tool to execute</p></div>
                </div>
              )}
              {history.map((entry) => (
                <div key={entry.id}>
                  {entry.type === 'input' ? (
                    <div className="text-primary flex items-start gap-2"><span className="text-muted-foreground shrink-0">[{entry.timestamp}]</span><span className="opacity-80">&gt;</span><span>{entry.content}</span></div>
                  ) : entry.type === 'error' ? (
                    <div className="text-danger flex items-start gap-2"><span className="text-muted-foreground shrink-0">[{entry.timestamp}]</span><XCircle className="h-3 w-3 shrink-0 mt-0.5" /><span>{entry.content}</span></div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground shrink-0">[{entry.timestamp}]</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {entry.decision === 'ALLOWED' ? <CheckCircle className="h-3 w-3 text-success shrink-0" /> : entry.decision === 'DENIED' ? <AlertTriangle className="h-3 w-3 text-warning shrink-0" /> : <XCircle className="h-3 w-3 text-danger shrink-0" />}
                          <span className={entry.decision === 'ALLOWED' ? 'text-success' : entry.decision === 'DENIED' ? 'text-warning' : 'text-danger'}>{entry.decision}</span>
                          {entry.execution_time_ms !== undefined && <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {entry.execution_time_ms.toFixed(1)}ms</span>}
                          {entry.risk_score !== undefined && <span className={`flex items-center gap-1 ${entry.risk_score > 80 ? 'text-danger' : entry.risk_score > 60 ? 'text-warning' : 'text-muted-foreground'}`}><Zap className="h-3 w-3" /> Risk: {entry.risk_score.toFixed(0)}</span>}
                          {entry.is_honeytool && <Badge variant="danger" className="text-[9px]">HONEYTOOL</Badge>}
                        </div>
                        <p className="text-muted-foreground mt-0.5">{entry.content}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-primary" /> Tool Palette</h3>
            {selectedAgent ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><Bot className="h-3 w-3" /> Real Tools</p>
                  <div className="flex flex-col gap-1.5">
                    {REAL_TOOLS.map((tool) => {
                      const Icon = tool.icon
                      const active = selectedTool?.name === tool.name
                      return (
                        <button key={tool.name} onClick={() => { setSelectedTool(tool); setToolArgs({}) }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-colors text-left ${active ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}>
                          <Icon className="h-3.5 w-3.5 shrink-0" /><span>{tool.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1 text-danger"><ShieldAlert className="h-3 w-3" /> Honeytools</p>
                  <div className="flex flex-col gap-1.5">
                    {HONEYTOOLS.map((tool) => {
                      const active = selectedTool?.name === tool.name
                      return (
                        <button key={tool.name} onClick={() => { setSelectedTool(tool); setToolArgs({}) }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-colors text-left ${active ? 'bg-danger/20 text-danger ring-1 ring-danger/40' : 'bg-danger/5 hover:bg-danger/10 text-danger/70 hover:text-danger'}`}>
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" /><span>{tool.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select an agent first</p>
            )}
          </div>

          {selectedTool && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold flex items-center gap-2 text-sm"><Terminal className="h-4 w-4 text-primary" /> Args</h3>
              <div className="space-y-3">
                {selectedTool.args.length === 0 ? (
                  <p className="text-xs text-muted-foreground">This tool requires no arguments</p>
                ) : (
                  selectedTool.args.map((arg) => (
                    <div key={arg.key}>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{arg.label}</label>
                      <Input value={toolArgs[arg.key] || ''} onChange={(e) => setToolArgs((prev) => ({ ...prev, [arg.key]: e.target.value }))} placeholder={arg.placeholder} className="font-mono text-xs" onKeyDown={(e) => e.key === 'Enter' && execute()} />
                    </div>
                  ))
                )}
                <Button onClick={execute} disabled={!selectedAgent || selectedAgent.status !== 'ACTIVE' || !selectedTool || running || selectedTool.args.some((a) => !toolArgs[a.key]?.trim())} className="w-full gap-2" size="sm">
                  {running ? <Activity className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Execute {selectedTool.label}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
