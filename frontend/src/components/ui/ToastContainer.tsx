import { X, CheckCircle, AlertTriangle, AlertCircle, Info, ShieldAlert } from 'lucide-react'
import { useToastStore, type ToastVariant } from '@/store/toast'
import { cn } from '@/lib/utils'

const variantConfig: Record<ToastVariant, { bg: string; border: string; icon: React.ReactNode }> = {
  success: { bg: 'bg-success/5', border: 'border-success/30', icon: <CheckCircle className="h-4 w-4 text-success" /> },
  warning: { bg: 'bg-warning/5', border: 'border-warning/30', icon: <AlertTriangle className="h-4 w-4 text-warning" /> },
  error: { bg: 'bg-danger/5', border: 'border-danger/30', icon: <AlertCircle className="h-4 w-4 text-danger" /> },
  info: { bg: 'bg-primary/5', border: 'border-primary/30', icon: <Info className="h-4 w-4 text-primary" /> },
  containment: { bg: 'bg-danger/10', border: 'border-danger/50', icon: <ShieldAlert className="h-4 w-4 text-danger" /> },
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const cfg = variantConfig[toast.variant]
        return (
          <div key={toast.id} className={cn(
            'pointer-events-auto rounded-md border p-3 shadow-lg animate-in slide-in-from-top-2',
            'transition-all duration-300',
            cfg.bg, cfg.border
          )}>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{toast.message}</p>
                {toast.description && <p className="text-xs text-muted-foreground mt-0.5">{toast.description}</p>}
                {toast.action && (
                  <button onClick={toast.action.onClick}
                    className="mt-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
