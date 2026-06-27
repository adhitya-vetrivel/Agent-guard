import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight, LayoutDashboard, Bot, ShieldCheck, ScrollText, AlertTriangle, Activity, Settings, Terminal, Brain, GitCompare, Network, Monitor, SkipForward, Clapperboard, FileText, Clock, GitBranch, Swords, Film, Eye, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  label: string
  href: string
  icon: typeof LayoutDashboard
  keywords: string[]
}

const commands: CommandItem[] = [
  { id: '1', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, keywords: ['home', 'main', 'overview'] },
  { id: '2', label: 'Live Logs', href: '/live', icon: Terminal, keywords: ['stream', 'realtime', 'websocket'] },
  { id: '3', label: 'System Health', href: '/system-health', icon: Activity, keywords: ['health', 'status', 'metrics'] },
  { id: '4', label: 'Threat Graph', href: '/threat-graph', icon: Network, keywords: ['graph', 'visualization', 'threats'] },
  { id: '5', label: 'Incidents', href: '/incidents', icon: FileText, keywords: ['alerts', 'events', 'breaches'] },
  { id: '6', label: 'Risk Events', href: '/risk-events', icon: AlertTriangle, keywords: ['risk', 'events'] },
  { id: '7', label: 'Risk Timeline', href: '/risk-timeline', icon: GitBranch, keywords: ['timeline', 'history'] },
  { id: '8', label: 'Forensic Timeline', href: '/forensic', icon: Clock, keywords: ['forensic', 'investigation'] },
  { id: '8b', label: 'Replay Center', href: '/replay', icon: Film, keywords: ['replay', 'attack', 'cctv', 'playback'] },
  { id: '8c', label: 'Operator Monitoring', href: '/operator-security', icon: Eye, keywords: ['operator', 'watcher', 'admin', 'human'] },
  { id: '8d', label: 'HoneyTool Center', href: '/honeytool-center', icon: Shield, keywords: ['honeytool', 'trap', 'decoy'] },
  { id: '9', label: 'Anomaly Detection', href: '/anomaly', icon: Brain, keywords: ['anomaly', 'ml', 'ai'] },
  { id: '10', label: 'Audit Trail', href: '/audit', icon: ScrollText, keywords: ['audit', 'logs', 'compliance'] },
  { id: '11', label: 'All Agents', href: '/agents', icon: Bot, keywords: ['agents', 'list', 'agents'] },
  { id: '12', label: 'Agent Console', href: '/console', icon: Monitor, keywords: ['console', 'shell', 'terminal'] },
  { id: '13', label: 'Agent Comparison', href: '/compare', icon: GitCompare, keywords: ['compare', 'diff'] },
  { id: '14', label: 'Policies', href: '/policies', icon: ShieldCheck, keywords: ['policies', 'rules', 'config'] },
  { id: '15', label: 'Settings', href: '/settings', icon: Settings, keywords: ['settings', 'preferences', 'config'] },
  { id: '16', label: 'Demo Director', href: '/demo-director', icon: Clapperboard, keywords: ['demo', 'director', 'presentation'] },
  { id: '17', label: 'Attack Scenarios', href: '/scenarios', icon: SkipForward, keywords: ['scenarios', 'attacks', 'simulation'] },
  { id: '18', label: 'Simulate Attack', href: '#simulate', icon: Swords, keywords: ['simulate', 'attack', 'test', 'honeytoken'] },
]

interface CommandPaletteProps {
  onClose: () => void
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords.some((k) => k.includes(query.toLowerCase()))
      )
    : commands

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const execute = (item: CommandItem) => {
    if (item.href === '#simulate') {
      onClose()
      return
    }
    navigate(item.href)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      execute(filtered[selectedIndex])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-lg border bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No results</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onClick={() => execute(item)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors text-left',
                  i === selectedIndex ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <ArrowRight className={cn('h-3 w-3 shrink-0', i === selectedIndex ? 'opacity-100' : 'opacity-0')} />
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border px-3 py-1.5 text-2xs text-muted-foreground flex items-center gap-3">
          <span><kbd className="rounded border bg-muted px-1">↑↓</kbd> Navigate</span>
          <span><kbd className="rounded border bg-muted px-1">Enter</kbd> Open</span>
          <span><kbd className="rounded border bg-muted px-1">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
