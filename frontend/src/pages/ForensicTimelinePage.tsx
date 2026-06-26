import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Terminal, Shield, AlertTriangle, Search } from 'lucide-react'
import { request } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ForensicEntry {
  id: string; timestamp: string; type: 'tool_call' | 'risk_event' | 'containment' | 'incident'
  source: string; detail: string; severity: string; risk_score: number
}

export function ForensicTimelinePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: toolCalls } = useQuery({ queryKey: ['tool-calls-forensic'], queryFn: () => request('/agents/tool-calls?limit=200'), refetchInterval: 10000 })
  const { data: riskEvents } = useQuery({ queryKey: ['risk-events-forensic'], queryFn: () => request('/risk-events?limit=200'), refetchInterval: 10000 })

  const timeline = useMemo(() => {
    const entries: ForensicEntry[] = []
    if (Array.isArray(toolCalls)) {
      for (const tc of toolCalls) {
        if (!tc.created_at) continue
        entries.push({ id: tc.id, timestamp: tc.created_at, type: 'tool_call', source: tc.agent_name || 'unknown', detail: `${tc.decision}: ${tc.tool_name}${tc.is_honeytool ? ' [HONEYTOOL]' : ''}`, severity: tc.decision === 'BLOCKED' ? 'CRITICAL' : tc.decision === 'DENIED' ? 'HIGH' : 'SAFE', risk_score: tc.risk_score || 0 })
      }
    }
    if (Array.isArray(riskEvents)) {
      for (const re of riskEvents) {
        if (!re.created_at) continue
        entries.push({ id: `re-${re.id}`, timestamp: re.created_at, type: 'risk_event', source: re.agent_name || 'unknown', detail: re.reason, severity: re.severity, risk_score: re.risk_score })
      }
    }
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    if (typeFilter) return entries.filter(e => e.type === typeFilter)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return entries.filter(e => e.source.toLowerCase().includes(term) || e.detail.toLowerCase().includes(term))
    }
    return entries.slice(0, 200)
  }, [toolCalls, riskEvents, typeFilter, searchTerm])

  const typeIcon = (t: string) => {
    if (t === 'tool_call') return <Terminal className="h-3 w-3" />
    if (t === 'risk_event') return <AlertTriangle className="h-3 w-3" />
    return <Clock className="h-3 w-3" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Forensic Timeline</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Complete chronological event history</p>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input placeholder="Search events..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 h-9 rounded-md border bg-background px-3 py-1 text-sm" />
        </div>
        <div className="flex gap-1">
          {['', 'tool_call', 'risk_event', 'containment'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-3 py-1.5 text-xs rounded-md transition-colors', typeFilter === t ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}>
              {t.replace('_', ' ') || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-px bg-border" />
          <div className="max-h-[70vh] overflow-y-auto">
            {timeline.length === 0 && (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                <div className="text-center"><Clock className="mx-auto h-8 w-8 mb-2 opacity-50" /><p>No events recorded yet</p></div>
              </div>
            )}
            {timeline.map((entry, i) => {
              const prevTime = i > 0 ? new Date(timeline[i - 1].timestamp) : null
              const currTime = new Date(entry.timestamp)
              const showTime = !prevTime || Math.abs(currTime.getTime() - prevTime.getTime()) > 60000
              return (
                <div key={entry.id} className="relative pl-16 pr-4 py-2 hover:bg-muted/20">
                  <div className={cn('absolute left-[29px] w-[11px] h-[11px] rounded-full border-2 border-background mt-1',
                    entry.severity === 'CRITICAL' ? 'bg-danger' : entry.severity === 'HIGH' ? 'bg-warning' : entry.severity === 'WARNING' ? 'bg-yellow-500' : 'bg-muted-foreground')} />
                  {showTime && <div className="text-[10px] text-muted-foreground font-mono mb-1">{currTime.toLocaleDateString()} {currTime.toLocaleTimeString()}</div>}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="shrink-0">{typeIcon(entry.type)}</span>
                    <Badge variant={entry.severity === 'CRITICAL' ? 'danger' : entry.severity === 'HIGH' ? 'warning' : 'default'} className="text-[7px] shrink-0">{entry.type.replace('_', ' ')}</Badge>
                    <span className="font-mono text-muted-foreground shrink-0">{entry.source}</span>
                    <span className="text-muted-foreground truncate">{entry.detail}</span>
                    <span className="font-mono shrink-0 ml-auto">{entry.risk_score.toFixed(0)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
