import { Activity } from 'lucide-react'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Activity className="h-5 w-5 animate-spin text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground/60">{message}</p>
      </div>
    </div>
  )
}
