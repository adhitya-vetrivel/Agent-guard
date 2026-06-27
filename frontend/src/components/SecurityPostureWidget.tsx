import { Shield, ShieldCheck, ShieldOff, Swords, Ban, CheckCircle, AlertTriangle } from 'lucide-react'
import type { DashboardStats } from '@/types'

interface PostureWidgetProps {
  stats: DashboardStats
  honeytoolTriggers: number
  containmentEvents: number
}

type PostureStatus = 'safe' | 'warning' | 'contained'

function getPosture(stats: DashboardStats, containmentEvents: number): PostureStatus {
  if (containmentEvents > 0) return 'contained'
  if (stats.threats_detected > 0 || stats.blocked_agents > 0) return 'warning'
  return 'safe'
}

const postureConfig = {
  safe: { icon: ShieldCheck, label: 'SAFE', color: 'text-success', bg: 'bg-success/10', border: 'border-success/30', bar: 'bg-success' },
  warning: { icon: AlertTriangle, label: 'WARNING', color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', bar: 'bg-warning' },
  contained: { icon: ShieldOff, label: 'CONTAINED', color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/30', bar: 'bg-danger' },
}

export function SecurityPostureWidget({ stats, honeytoolTriggers, containmentEvents }: PostureWidgetProps) {
  const posture = getPosture(stats, containmentEvents)
  const cfg = postureConfig[posture]
  const Icon = cfg.icon

  const metrics = [
    { label: 'Agents Protected', value: stats.total_agents, icon: Shield, color: 'text-primary' },
    { label: 'Threats Contained', value: stats.blocked_agents + stats.quarantined_agents, icon: Ban, color: 'text-danger' },
    { label: 'HoneyTool Activations', value: honeytoolTriggers, icon: Swords, color: 'text-warning' },
    { label: 'Successful Escapes', value: 0, icon: CheckCircle, color: 'text-success' },
  ]

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid lg:grid-cols-3 gap-px bg-border">
        <div className={`lg:col-span-1 p-5 flex flex-col items-center justify-center ${cfg.bg} border-b lg:border-b-0 lg:border-r border-border`}>
          <div className={`flex h-14 w-14 items-center justify-center rounded-full border ${cfg.border}`}>
            <Icon className={`h-7 w-7 ${cfg.color}`} />
          </div>
          <span className={`mt-2 text-xl font-bold tracking-wider ${cfg.color}`}>
            {cfg.label}
          </span>
          <span className="text-xs text-muted-foreground mt-0.5">Security Posture</span>
        </div>

        <div className="lg:col-span-2 p-5">
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center gap-3 rounded bg-muted/30 p-3">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <div>
                  <p className="text-xl font-bold tabular-nums leading-none">{m.value}</p>
                  <p className="text-caption text-muted-foreground mt-0.5">{m.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="h-1 bg-muted/30">
        <div
          className={`h-full transition-all duration-700 ease-out ${cfg.bar}`}
          style={{ width: posture === 'safe' ? '25%' : posture === 'warning' ? '66%' : '100%' }}
        />
      </div>
    </div>
  )
}
