import { cn } from '@/lib/utils'

interface StatusIndicatorProps {
  status: 'active' | 'warning' | 'danger' | 'inactive'
  label?: string
  size?: 'sm' | 'md'
}

export function StatusIndicator({ status, label, size = 'sm' }: StatusIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn(
        'rounded-full shrink-0',
        size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
        status === 'active' && 'bg-success',
        status === 'warning' && 'bg-warning',
        status === 'danger' && 'bg-danger',
        status === 'inactive' && 'bg-muted-foreground/40',
      )} />
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </span>
  )
}
