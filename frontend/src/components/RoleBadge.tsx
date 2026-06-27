import { Badge } from '@/components/ui/badge'
import type { Role } from '@/types'

const ROLE_STYLES: Record<Role, { variant: 'default' | 'outline' | 'success' | 'warning' | 'danger'; label: string }> = {
  admin: { variant: 'danger', label: 'ADMIN' },
  analyst: { variant: 'default', label: 'ANALYST' },
  operator: { variant: 'warning', label: 'OPERATOR' },
  engineer: { variant: 'success', label: 'ENGINEER' },
  viewer: { variant: 'outline', label: 'VIEWER' },
  demo: { variant: 'outline', label: 'DEMO' },
}

export function RoleBadge({ role }: { role: Role }) {
  const style = ROLE_STYLES[role] ?? { variant: 'outline' as const, label: role.toUpperCase() }
  return (
    <Badge variant={style.variant} className="text-[10px] px-1.5 py-0">
      {style.label}
    </Badge>
  )
}
