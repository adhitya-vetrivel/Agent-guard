import { useState, useEffect, useRef } from 'react'
import { Bell, X, CheckCircle, AlertTriangle, AlertCircle, Info, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { getToken } from '@/services/api'

interface Notification {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  timestamp: string
  link?: string
  read: boolean
}

const icons = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
}

const iconColors = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
  info: 'text-primary',
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/dashboard?token=${encodeURIComponent(token)}`)
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        const data = msg.data || msg
        const type = msg.type || data.type || ''
        const ts = data.timestamp ? new Date(data.timestamp).toLocaleString() : new Date().toLocaleString()
        if (type === 'containment') {
          const n: Notification = { id: `n-${Date.now()}`, type: 'error', title: 'Agent Contained', message: `${data.agent_name || 'Unknown'}: ${data.reason || 'Containment triggered'}`, timestamp: ts, read: false, link: '/incidents' }
          setNotifications((prev) => [n, ...prev].slice(0, 20))
        } else if (type === 'risk_update' && (data.risk_score || 0) > 80) {
          const n: Notification = { id: `n-${Date.now()}`, type: 'warning', title: 'Critical Risk', message: `${data.agent_name || 'Unknown'} risk score: ${data.risk_score}`, timestamp: ts, read: false, link: '/risk-events' }
          setNotifications((prev) => [n, ...prev].slice(0, 20))
        }
      } catch {}
    }
    ws.onerror = () => {}
    return () => ws.close()
  }, [])

  const unread = notifications.filter((n) => !n.read).length

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-danger-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold text-foreground">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-2xs text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No notifications</p>
            ) : (
              notifications.map((n) => {
                const Icon = icons[n.type]
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-2.5 border-b border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent/30',
                      !n.read && 'bg-accent/20'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', iconColors[n.type])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">{n.title}</p>
                      <p className="text-2xs text-muted-foreground mt-0.5">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xs text-muted-foreground">{n.timestamp}</span>
                        {n.link && (
                          <button
                            onClick={() => { navigate(n.link!); setOpen(false) }}
                            className="text-2xs text-primary hover:underline inline-flex items-center gap-0.5"
                          >
                            View <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
