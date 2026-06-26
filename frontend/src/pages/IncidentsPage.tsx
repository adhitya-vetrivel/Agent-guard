import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Shield, Download, FileText, Search } from 'lucide-react'
import { request } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Incident {
  id: string; agent_id: string; agent_name: string; agent_role: string; severity: string; status: string;
  trigger_reason: string; trigger_type: string; timeline: string[]; risk_breakdown: Record<string, number>;
  actions_taken: string[]; containment_status: string; tools_invoked: string[]; recommended_actions: string[];
  created_at: string; resolved_at: string | null;
}

export function IncidentsPage() {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  const { data: incidents } = useQuery<Incident[]>({
    queryKey: ['incidents', severityFilter],
    queryFn: () => request(`/incidents?${severityFilter ? `severity=${severityFilter}` : ''}`),
    refetchInterval: 5000,
  })

  const filtered = (incidents || []).filter(i =>
    !searchTerm || i.agent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.trigger_reason.toLowerCase().includes(searchTerm.toLowerCase()) || i.trigger_type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const exportData = (format: string) => {
    const a = document.createElement('a')
    a.href = `/api/incidents?export=${format}${severityFilter ? `&severity=${severityFilter}` : ''}`
    a.download = `incidents.${format}`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incident Reports</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Automatically generated security incident reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportData('json')} className="gap-2"><FileText className="h-3 w-3" /> JSON</Button>
          <Button variant="outline" size="sm" onClick={() => exportData('csv')} className="gap-2"><Download className="h-3 w-3" /> CSV</Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input placeholder="Search incidents..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 h-9 rounded-md border bg-background px-3 py-1 text-sm" />
        </div>
        <div className="flex gap-1">
          {['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              className={cn('px-3 py-1.5 text-xs rounded-md transition-colors', severityFilter === s ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}>{s || 'All'}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto">
          {filtered.map((inc) => (
            <button key={inc.id} onClick={() => setSelectedIncident(inc)}
              className={cn('w-full text-left p-3 rounded-lg border transition-colors', selectedIncident?.id === inc.id ? 'bg-primary/10 border-primary/30' : 'bg-card border-border hover:bg-muted/50')}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-xs truncate">{inc.agent_name}</span>
                <Badge variant={inc.severity === 'CRITICAL' ? 'danger' : inc.severity === 'HIGH' ? 'warning' : 'default'} className="text-[8px]">{inc.severity}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{inc.trigger_reason}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default" className="text-[7px]">{inc.trigger_type}</Badge>
                <span className="text-[9px] text-muted-foreground">{new Date(inc.created_at).toLocaleTimeString()}</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No incidents reported</p>}
        </div>

        <div className="lg:col-span-2">
          {selectedIncident ? (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{selectedIncident.agent_name}</span>
                  <Badge variant={selectedIncident.severity === 'CRITICAL' ? 'danger' : selectedIncident.severity === 'HIGH' ? 'warning' : 'default'}>{selectedIncident.severity}</Badge>
                </div>
                <Badge variant={selectedIncident.status === 'CONTAINED' ? 'danger' : selectedIncident.status === 'RESOLVED' ? 'success' : 'warning'}>{selectedIncident.status}</Badge>
              </div>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Agent Role', value: selectedIncident.agent_role },
                    { label: 'Trigger', value: selectedIncident.trigger_type },
                    { label: 'Containment', value: selectedIncident.containment_status },
                    { label: 'Time', value: new Date(selectedIncident.created_at).toLocaleString() },
                  ].map(f => (
                    <div key={f.label}><p className="text-[10px] text-muted-foreground uppercase">{f.label}</p><p className="font-mono text-xs">{f.value}</p></div>
                  ))}
                </div>
                <div><p className="text-[10px] text-muted-foreground uppercase mb-1">Trigger Reason</p><p className="text-xs bg-muted/50 p-2 rounded">{selectedIncident.trigger_reason}</p></div>
                {Object.keys(selectedIncident.risk_breakdown || {}).length > 0 && (
                  <div><p className="text-[10px] text-muted-foreground uppercase mb-1">Risk Breakdown</p>
                    <div className="space-y-1">{Object.entries(selectedIncident.risk_breakdown).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-xs bg-muted/30 px-2 py-1 rounded"><span className="font-mono">{key.replace(/_/g, ' ')}</span><span className={val > 0 ? 'text-danger' : ''}>+{val}</span></div>
                    ))}</div>
                  </div>
                )}
                {selectedIncident.tools_invoked.length > 0 && (
                  <div><p className="text-[10px] text-muted-foreground uppercase mb-1">Tools Invoked</p>
                    <div className="flex flex-wrap gap-1">{selectedIncident.tools_invoked.map((t, i) => (<Badge key={i} variant="outline" className="text-[9px]">{t}</Badge>))}</div>
                  </div>
                )}
                {selectedIncident.actions_taken.length > 0 && (
                  <div><p className="text-[10px] text-muted-foreground uppercase mb-1">Actions Taken</p>
                    <ul className="list-disc list-inside space-y-0.5">{selectedIncident.actions_taken.map((a, i) => (<li key={i} className="text-xs text-muted-foreground">{a}</li>))}</ul>
                  </div>
                )}
                {selectedIncident.recommended_actions.length > 0 && (
                  <div><p className="text-[10px] text-muted-foreground uppercase mb-1">Recommended Actions</p>
                    <ul className="list-disc list-inside space-y-0.5">{selectedIncident.recommended_actions.map((a, i) => (<li key={i} className="text-xs">{a}</li>))}</ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground">
              <div className="text-center"><AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-50" /><p>Select an incident to view details</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
