import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Download, Activity, Terminal, ShieldAlert, UserPlus, Ban, AlertTriangle, ScrollText, Clock, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import type { AuditLog } from '@/types'

type SortKey = 'timestamp' | 'action' | 'agent_name' | 'risk_score' | 'decision'
type SortDir = 'asc' | 'desc'

const actionIcons: Record<string, React.ReactNode> = {
  TOOL_EXECUTE: <Terminal className="h-4 w-4" />, DECOY_TRIGGER: <AlertTriangle className="h-4 w-4" />,
  AGENT_REGISTER: <UserPlus className="h-4 w-4" />, AGENT_BLOCKED: <Ban className="h-4 w-4" />, CONTAINMENT: <ShieldAlert className="h-4 w-4" />,
}

export function AuditPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const pageSize = 30

  const searchTimer = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>
    return (val: string) => { clearTimeout(timer); timer = setTimeout(() => setDebouncedSearch(val), 250) }
  }, [])

  const { data: allLogs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'], queryFn: () => api.getAuditLogs(), refetchInterval: 10000,
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'timestamp' ? 'desc' : 'asc') }
    setPage(0)
  }

  const SortButton = ({ label, sortField }: { label: string; sortField: SortKey }) => (
    <button onClick={() => toggleSort(sortField)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
      {label}{sortKey === sortField ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
    </button>
  )

  const filtered = useMemo(() => {
    if (!allLogs) return []
    let logs = allLogs
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase()
      logs = logs.filter((l) => l.agent_name?.toLowerCase().includes(s) || l.tool_name?.toLowerCase().includes(s) || l.action?.toLowerCase().includes(s) || l.reason?.toLowerCase().includes(s))
    }
    if (actionFilter) logs = logs.filter((l) => l.action === actionFilter)
    if (severityFilter) {
      logs = logs.filter((l) => {
        const rs = l.risk_score ?? 0
        if (severityFilter === 'CRITICAL') return rs > 80
        if (severityFilter === 'HIGH') return rs > 60 && rs <= 80
        if (severityFilter === 'WARNING') return rs > 30 && rs <= 60
        if (severityFilter === 'SAFE') return rs <= 30
        return true
      })
    }
    logs.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'timestamp') cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      else if (sortKey === 'action') cmp = (a.action || '').localeCompare(b.action || '')
      else if (sortKey === 'agent_name') cmp = (a.agent_name || '').localeCompare(b.agent_name || '')
      else if (sortKey === 'risk_score') cmp = (a.risk_score || 0) - (b.risk_score || 0)
      else if (sortKey === 'decision') cmp = (a.decision || '').localeCompare(b.decision || '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return logs
  }, [allLogs, debouncedSearch, actionFilter, sortKey, sortDir])

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)
  const actions = useMemo(() => { if (!allLogs) return []; return [...new Set(allLogs.map((l) => l.action))] }, [allLogs])

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Trail</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{filtered.length} events recorded</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (!filtered.length) return
            const header = 'Timestamp,Action,Agent,Tool,Decision,Risk,Reason\n'
            const rows = filtered.map((l) => `${l.timestamp},${l.action},${l.agent_name || ''},${l.tool_name || ''},${l.decision || ''},${l.risk_score ?? ''},"${(l.reason || '').replace(/"/g, '""')}"`).join('\n')
            const blob = new Blob([header + rows], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
            URL.revokeObjectURL(url)
          }} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); searchTimer(e.target.value); setPage(0) }} placeholder="Search events..." className="pl-10" />
        </div>
        <Select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0) }} options={[{ value: '', label: 'All Actions' }, ...actions.map((a) => ({ value: a, label: a }))]} className="w-full sm:w-48" />
        <Select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(0) }} options={[
          { value: '', label: 'All Severities' }, { value: 'CRITICAL', label: 'CRITICAL (80+)' }, { value: 'HIGH', label: 'HIGH (60-80)' },
          { value: 'WARNING', label: 'WARNING (30-60)' }, { value: 'SAFE', label: 'SAFE (0-30)' },
        ]} className="w-full sm:w-48" />
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="text-[10px] uppercase tracking-wider">Sort by:</span>
        <SortButton label="Timestamp" sortField="timestamp" />
        <SortButton label="Action" sortField="action" />
        <SortButton label="Agent" sortField="agent_name" />
        <SortButton label="Risk" sortField="risk_score" />
        <SortButton label="Decision" sortField="decision" />
      </div>

      <div className="relative">
        <div className="space-y-2">
          {paged.map((log) => {
            const action = log.action
            const icon = actionIcons[action] || <ScrollText className="h-4 w-4" />
            return (
              <div key={log.id} className="rounded-lg border bg-card p-4 border-l-4 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setSelectedLog(log)}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={action.includes('CONTAIN') || action.includes('DECOY') ? 'danger' : action.includes('DENIED') || action.includes('BLOCK') ? 'warning' : action === 'TOOL_EXECUTE' ? 'success' : 'default'} className="text-[10px]">{action}</Badge>
                        {log.agent_name && <span className="text-sm font-medium">{log.agent_name}</span>}
                      </div>
                      <div className="flex items-center gap-3 sm:ml-auto text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(log.timestamp).toLocaleString()}</span>
                        {log.risk_score !== null && log.risk_score !== undefined && (
                          <span className={`font-mono ${log.risk_score > 80 ? 'text-danger' : log.risk_score > 50 ? 'text-warning' : 'text-muted-foreground'}`}>Risk: {log.risk_score.toFixed(0)}</span>
                        )}
                      </div>
                    </div>
                    {log.reason && <p className="mt-1 text-sm text-muted-foreground">{log.reason}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {log.tool_name && <span className="font-mono bg-muted/30 px-2 py-0.5 rounded">Tool: {log.tool_name}</span>}
                      {log.decision && <Badge variant={log.decision === 'ALLOWED' ? 'success' : log.decision === 'DENIED' ? 'warning' : 'danger'} className="text-[10px]">{log.decision}</Badge>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {paged.length === 0 && <div className="py-12 text-center text-muted-foreground"><ScrollText className="mx-auto h-8 w-8 mb-2 opacity-50" /><p>No audit events match your filters</p></div>}
        </div>
      </div>

      <Dialog open={selectedLog !== null} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Audit Event Detail</DialogTitle></DialogHeader>
          {selectedLog && (
            <div className="space-y-2">
              {[
                { label: 'Event ID', value: selectedLog.id }, { label: 'Action', value: selectedLog.action },
                { label: 'Timestamp', value: new Date(selectedLog.timestamp).toLocaleString() }, { label: 'Agent', value: selectedLog.agent_name || '\u2014' },
                { label: 'Agent ID', value: selectedLog.agent_id || '\u2014' }, { label: 'Tool', value: selectedLog.tool_name || '\u2014' },
                { label: 'Decision', value: selectedLog.decision || '\u2014' }, { label: 'Risk Score', value: selectedLog.risk_score !== null ? selectedLog.risk_score.toFixed(1) : '\u2014' },
                { label: 'Reason', value: selectedLog.reason || '\u2014' }, { label: 'Details', value: selectedLog.details || '\u2014' },
                { label: 'IP Address', value: selectedLog.ip_address || '\u2014' }, { label: 'Session ID', value: selectedLog.session_id || '\u2014' },
                { label: 'User ID', value: selectedLog.user_id || '\u2014' },
              ].map((f) => (
                <div key={f.label} className="rounded-lg bg-muted/20 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</p>
                  <p className="mt-0.5 text-sm break-all">{f.value}</p>
                </div>
              ))}
            </div>
          )}
          <DialogClose asChild><Button variant="outline" className="w-full mt-2">Close</Button></DialogClose>
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Previous</Button>
          <span className="text-sm text-muted-foreground px-2">Page {page + 1} of {totalPages} ({filtered.length} total)</span>
          <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>Next</Button>
        </div>
      )}
    </div>
  )
}
