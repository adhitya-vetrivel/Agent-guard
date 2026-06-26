import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export function StatCard({ title, value, icon, trend, variant = 'default' }: StatCardProps) {
  const iconColor = variant === 'success' ? 'text-success' :
    variant === 'warning' ? 'text-warning' :
    variant === 'danger' ? 'text-danger' : 'text-muted-foreground'

  return (
    <div className={cn(
      "rounded-lg border bg-card p-3.5 transition-colors hover:bg-accent/30",
    )}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums truncate">{value}</p>
          {trend && (
            <p className="text-2xs text-muted-foreground mt-0.5">{trend}</p>
          )}
        </div>
        <div className={cn("shrink-0 mt-0.5", iconColor)}>
          {icon}
        </div>
      </div>
    </div>
  )
}
