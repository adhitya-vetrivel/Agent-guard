import { useState, useEffect, useRef } from 'react'
import { Terminal, Activity, Filter, Download, Trash2, Pause, Play, ArrowDownToLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { getToken } from '@/services/api'

interface LogEntry {
  id: string
  timestamp: string
  agent_name: string
  tool_name: string
  decision: string
  risk_score: number
  is_honeytool: boolean
}

export function LiveLogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filterDecision, setFilterDecision] = useState('')
  const [paused, setPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = getToken()
    if (!token) return
    const wsUrl = `${protocol}//${window.location.host}/ws/dashboard?token=${encodeURIComponent(token)}`
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>
    let closed = false
    const connect = () => {
      if (closed) return
      try {
        ws = new WebSocket(wsUrl)
        ws.onopen = () => setConnected(true)
        ws.onmessage = (event) => {
          if (paused) return
          try {
            const msg = JSON.parse(event.data)
            const data = msg.data || msg
            const type = msg.type || data.type || ''
            if (type === 'tool_execution' || data.tool_name) {
              setLogs((prev) => {
                const entry: LogEntry = {
                  id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  timestamp: new Date().toISOString(),
                  agent_name: data.agent_name || 'Unknown',
                  tool_name: data.tool_name || '',
                  decision: data.decision || 'ALLOWED',
                  risk_score: data.risk_score || 0,
                  is_honeytool: data.is_honeytool || false,
                }
                return [...prev, entry].slice(-500)
              })
            }
          } catch {}
        }
        ws.onclose = () => { setConnected(false); if (!closed) reconnectTimer = setTimeout(connect, 3000) }
        ws.onerror = () => { setConnected(false); if (!closed) reconnectTimer = setTimeout(connect, 5000) }
      } catch {}
    }
    connect()
    return () => { closed = true; ws?.close(); clearTimeout(reconnectTimer) }
  }, [paused])

  useEffect(() => { if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs, autoScroll])

  const filtered = filterDecision ? logs.filter((l) => l.decision === filterDecision) : logs

  const exportLogs = () => {
    const header = 'Timestamp,Agent,Tool,Decision,Risk\n'
    const rows = filtered.map((l) => `${l.timestamp},${l.agent_name},${l.tool_name},${l.decision},${l.risk_score}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `live-logs-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Logs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Real-time tool execution stream &middot; {filtered.length} events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={paused ? 'default' : 'outline'} size="sm" onClick={() => setPaused(!paused)} className="gap-2">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportLogs} className="gap-2"><Download className="h-4 w-4" /> Export</Button>
          <Button variant={autoScroll ? 'default' : 'outline'} size="sm" onClick={() => setAutoScroll(!autoScroll)} className="gap-2"><ArrowDownToLine className="h-4 w-4" />{autoScroll ? 'Auto' : 'Manual'}</Button>
          <Button variant="outline" size="sm" onClick={() => setLogs([])} className="gap-2"><Trash2 className="h-4 w-4" /> Clear</Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterDecision} onChange={(e) => setFilterDecision(e.target.value)} options={[
          { value: '', label: 'All Decisions' }, { value: 'ALLOWED', label: 'ALLOWED' }, { value: 'DENIED', label: 'DENIED' }, { value: 'BLOCKED', label: 'BLOCKED' },
        ]} className="w-40" />
        {paused && <span className="flex items-center gap-1 text-xs text-warning"><span className="h-2 w-2 rounded-full bg-warning animate-pulse" />PAUSED</span>}
      </div>

      <div className="rounded-lg border bg-black/40 font-mono text-xs overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-2 bg-muted/10">
          <Terminal className="h-3.5 w-3.5 text-primary" />
          <span className="text-primary text-[10px] uppercase tracking-wider">Tool Execution Stream</span>
          <span className="text-muted-foreground text-[10px]">&middot; Live</span>
          <span className="ml-auto flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
            <span className={`text-[10px] ${connected ? 'text-success' : 'text-danger'}`}>{connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
          </span>
        </div>

        <div ref={containerRef} className="h-[60vh] overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center"><Activity className="mx-auto h-6 w-6 mb-2 opacity-50" /><p className="text-xs">Waiting for tool executions...</p></div>
            </div>
          ) : (
            filtered.map((entry) => (
              <div key={entry.id} className={`flex items-center gap-3 px-3 py-1.5 rounded transition-colors ${
                entry.is_honeytool ? 'bg-danger/10 text-danger' : entry.decision === 'BLOCKED' ? 'bg-danger/5 text-danger' : entry.decision === 'DENIED' ? 'bg-warning/5 text-warning' : 'hover:bg-muted/10'
              }`}>
                <span className="text-[10px] text-muted-foreground w-16 shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="text-[10px] text-muted-foreground w-20 truncate shrink-0">[{entry.agent_name}]</span>
                <span className="text-primary text-[10px]">{entry.tool_name}</span>
                <div className="flex-1" />
                <Badge variant={entry.decision === 'ALLOWED' ? 'success' : entry.decision === 'DENIED' ? 'warning' : 'danger'} className="text-[9px] h-5">{entry.decision}</Badge>
                <span className={`text-[10px] font-mono w-12 text-right ${entry.risk_score > 80 ? 'text-danger' : entry.risk_score > 50 ? 'text-warning' : 'text-muted-foreground'}`}>{entry.risk_score.toFixed(0)}</span>
                {entry.is_honeytool && <span className="text-[9px] text-danger font-bold">HONEYTOOL</span>}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
