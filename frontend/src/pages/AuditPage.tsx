import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Download, Activity, Terminal, ScrollText, AlertTriangle, Ban, UserPlus, ShieldAlert } from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { DecisionExplanation } from '@/components/DecisionExplanation'
import { cn } from '@/lib/utils'
import type { AuditLog } from '@/types'

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
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const pageSize = 30

  const searchTimer = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>
    return (val: string) => { clearTimeout(timer); timer = setTimeout(() => setDebouncedSearch(val), 250) }
  }, [])

  const { data: allLogs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'], queryFn: () => api.getAuditLogs(), refetchInterval: 10000,
  })

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
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return logs
  }, [allLogs, debouncedSearch, actionFilter])

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)
  const actions = useMemo(() => { if (!allLogs) return []; return [...new Set(allLogs.map((l) => l.action))] }, [allLogs])

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-5 w-5 animate-spin text-muted-foreground/60" /></div>

  return (
    <div className="space-y-5">
      <PageHeader title="Audit Trail" description={`${filtered.length} events recorded`}>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => {
          if (!filtered.length) return
          const header = 'Timestamp,Action,Agent,Tool,Decision,Risk,Reason\n'
          const rows = filtered.map((l) => `${l.timestamp},${l.action},${l.agent_name || ''},${l.tool_name || ''},${l.decision || ''},${l.risk_score ?? ''},"${(l.reason || '').replace(/"/g, '""')}"`).join('\n')
          const blob = new Blob([header + rows], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
          URL.revokeObjectURL(url)
        }}><Download className="h-3 w-3" /> CSV</Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); searchTimer(e.target.value); setPage(0) }} placeholder="Search events..." className="pl-9 h-8 text-sm" />
        </div>
        <Select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0) }} options={[{ value: '', label: 'All Actions' }, ...actions.map((a) => ({ value: a, label: a }))]} className="w-full sm:w-44" />
        <Select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(0) }} options={[
          { value: '', label: 'All Severities' }, { value: 'CRITICAL', label: 'CRITICAL (80+)' }, { value: 'HIGH', label: 'HIGH (60-80)' },
          { value: 'WARNING', label: 'WARNING (30-60)' }, { value: 'SAFE', label: 'SAFE (0-30)' },
        ]} className="w-full sm:w-44" />
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-8"></th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Action</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Agent</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Tool</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">Risk</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-20">Time</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((log) => {
                const action = log.action
                return (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedLog(log)}>
                    <td className="px-3 py-2.5">
                      <span className="text-muted-foreground/60">{actionIcons[action] || <ScrollText className="h-4 w-4" />}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={action.includes('CONTAIN') || action.includes('DECOY') ? 'danger' : action.includes('DENIED') || action.includes('BLOCK') ? 'warning' : action === 'TOOL_EXECUTE' ? 'success' : 'default'} className="text-[9px]">{action}</Badge>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <span className="text-sm">{log.agent_name || <span className="text-muted-foreground/60">—</span>}</span>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <code className="text-xs text-muted-foreground font-mono">{log.tool_name || <span className="text-muted-foreground/60">—</span>}</code>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {log.risk_score !== null && log.risk_score !== undefined ? (
                        <span className={cn('text-xs font-mono tabular-nums', log.risk_score > 80 ? 'text-danger' : log.risk_score > 50 ? 'text-warning' : 'text-muted-foreground')}>
                          {log.risk_score.toFixed(0)}
                        </span>
                      ) : <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-muted-foreground/60">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {paged.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <ScrollText className="mx-auto h-6 w-6 mb-2 opacity-50" />
              <p className="text-sm">No audit events match your filters</p>
            </div>
          )}
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
                <div key={f.label} className="rounded bg-muted/20 p-2.5">
                  <p className="text-caption text-muted-foreground">{f.label}</p>
                  <p className="mt-0.5 text-sm break-all">{f.value}</p>
                </div>
              ))}
              {selectedLog.decision && (
                <DecisionExplanation
                  explanation={{
                    decision: selectedLog.decision,
                    reason: selectedLog.reason || `Audit event: ${selectedLog.action}`,
                    evidence: [
                      selectedLog.agent_name ? `Agent: ${selectedLog.agent_name}` : '',
                      selectedLog.tool_name ? `Tool: ${selectedLog.tool_name}()` : '',
                      selectedLog.details ? `Details: ${selectedLog.details}` : '',
                    ].filter(Boolean),
                    rule_triggered: selectedLog.action,
                    risk_contribution: selectedLog.risk_score ?? undefined,
                    timestamp: selectedLog.timestamp,
                  }}
                  compact
                />
              )}
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
