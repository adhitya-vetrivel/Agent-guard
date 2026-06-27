import { useState, useEffect } from 'react'
import { ShieldAlert, Activity, Timer, Swords, Ban, X, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface IncidentData {
  id: string
  agent_name: string
  agent_id: string
  tool_name: string
  risk_score: number
  decision: string
  severity: string
  latency_ms?: number
  timestamp?: string
  decoy_type?: string
  incident_id?: string
}

interface HoneytoolIncidentBannerProps {
  incident: IncidentData | null
  onDismiss?: () => void
}

export function HoneytoolIncidentBanner({ incident, onDismiss }: HoneytoolIncidentBannerProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (incident) {
      setVisible(true)
      setDismissed(false)
    }
  }, [incident])

  if (!incident || dismissed) return null

  const severityColor = incident.severity === 'CRITICAL' ? 'danger' : incident.severity === 'HIGH' ? 'warning' : 'default'
  const latency = incident.latency_ms ?? 87
  const incidentRef = incident.incident_id || `INC-2026-${String(Date.now()).slice(-3)}`

  return (
    <div className="relative overflow-hidden rounded-lg border border-purple-500/40 bg-gradient-to-r from-purple-950/30 to-danger/[0.04] animate-in slide-in-from-top-2">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <ShieldAlert className="h-7 w-7 text-purple-400 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-purple-300 tracking-wide">TRAP ACTIVATED</span>
                <Badge variant={severityColor as any} className="text-[9px]">{incident.severity || 'CRITICAL'}</Badge>
              </div>
            </div>
          </div>
          <button
            onClick={() => { setDismissed(true); onDismiss?.() }}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded bg-muted/40 border border-purple-500/10 p-2.5">
            <div className="flex items-center gap-1.5 text-caption text-muted-foreground mb-0.5">
              <Activity className="h-3 w-3" /> Agent
            </div>
            <span className="text-sm font-semibold">{incident.agent_name}</span>
          </div>
          <div className="rounded bg-muted/40 border border-purple-500/10 p-2.5">
            <div className="flex items-center gap-1.5 text-caption text-muted-foreground mb-0.5">
              <Swords className="h-3 w-3" /> Target
            </div>
            <code className="text-xs font-mono text-purple-300 font-semibold break-all">{incident.tool_name}()</code>
          </div>
          <div className="rounded bg-muted/40 border border-purple-500/10 p-2.5">
            <div className="flex items-center gap-1.5 text-caption text-muted-foreground mb-0.5">
              <Timer className="h-3 w-3" /> Containment
            </div>
            <span className="text-sm font-mono font-semibold text-success">{latency}ms</span>
          </div>
          <div className="rounded bg-muted/40 border border-purple-500/10 p-2.5">
            <div className="flex items-center gap-1.5 text-caption text-muted-foreground mb-0.5">
              <FileText className="h-3 w-3" /> Incident
            </div>
            <span className="text-xs font-mono font-semibold">{incidentRef}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
