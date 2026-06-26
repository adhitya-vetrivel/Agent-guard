import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Activity, Trash2 } from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RiskEvent } from '@/types'

export function RiskEventsPage() {
  const queryClient = useQueryClient()
  const { data: events, isLoading } = useQuery<RiskEvent[]>({
    queryKey: ['risk-events'], queryFn: () => api.getRiskEvents(), refetchInterval: 5000,
  })
  const clearMutation = useMutation({
    mutationFn: () => api.clearRiskEvents(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk-events'] }),
  })

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-8 w-8 animate-spin text-primary" /></div>

  const severityConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
    SAFE: { color: 'text-success', bg: 'bg-success/10', border: 'border-success/30', label: 'Safe' },
    WARNING: { color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', label: 'Warning' },
    HIGH: { color: 'text-warning', bg: 'bg-warning/20', border: 'border-warning/50', label: 'High' },
    CRITICAL: { color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/50', label: 'Critical' },
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Risk Events</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{events?.length || 0} total risk events</p>
        </div>
        {events && events.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending} className="gap-2">
            <Trash2 className="h-4 w-4" />{clearMutation.isPending ? 'Clearing...' : 'Clear All'}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {events?.map((event) => {
          const cfg = severityConfig[event.severity]
          return (
            <div key={event.id} className={`rounded-lg border bg-card p-4 border-l-4 ${cfg.border} ${event.severity === 'CRITICAL' ? 'flash-critical' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 rounded-lg p-2 ${cfg.bg}`}><AlertTriangle className={`h-5 w-5 ${cfg.color}`} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <h3 className="font-semibold truncate">{event.agent_name || 'Unknown Agent'}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={event.severity === 'CRITICAL' ? 'danger' : event.severity === 'HIGH' ? 'warning' : event.severity === 'WARNING' ? 'warning' : 'success'}>{cfg.label}</Badge>
                      <span className={`text-xs font-mono ${event.risk_score > 80 ? 'text-danger' : event.risk_score > 50 ? 'text-warning' : 'text-success'}`}>Score: {event.risk_score.toFixed(0)}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{event.reason}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {event.tool_name && <span className="font-mono">Tool: {event.tool_name}</span>}
                    <span>{new Date(event.created_at).toLocaleString()}</span>
                    {event.triggered_containment && <Badge variant="danger" className="text-[10px]">Containment Triggered</Badge>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {(!events || events.length === 0) && <div className="py-12 text-center text-muted-foreground">No risk events recorded</div>}
      </div>
    </div>
  )
}
