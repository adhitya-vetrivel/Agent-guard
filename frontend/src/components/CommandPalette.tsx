import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, ArrowRight, LayoutDashboard, Bot, ShieldCheck, ScrollText,
  Activity, Settings, Terminal, Film, Eye, Shield, Swords, Play
} from 'lucide-react'
import { api, request } from '@/services/api'
import { useToastStore } from '@/store/toast'
import { cn } from '@/lib/utils'
import type { Incident, Agent } from '@/types'

interface CommandItem {
  id: string
  label: string
  href?: string
  action?: 'navigate' | 'resolve' | 'quarantine' | 'scenario' | 'simulation'
  targetId?: string
  icon: any
  keywords: string[]
}

const STATIC_COMMANDS: CommandItem[] = [
  { id: 'nav-cc', label: 'Go to Command Center', href: '/command-center', icon: LayoutDashboard, keywords: ['home', 'main', 'overview', 'dashboard'] },
  { id: 'nav-fleet', label: 'Go to Fleet Workspace', href: '/fleet', icon: Bot, keywords: ['agents', 'fleet', 'list'] },
  { id: 'nav-invest', label: 'Go to Investigation Workspace', href: '/investigation', icon: ScrollText, keywords: ['alerts', 'events', 'breaches', 'incidents', 'timeline'] },
  { id: 'nav-decep', label: 'Go to Deception Center', href: '/deception-center', icon: Shield, keywords: ['honeytool', 'trap', 'decoy'] },
  { id: 'nav-ops', label: 'Go to Operator Security', href: '/operator-security', icon: Eye, keywords: ['operator', 'watcher', 'admin', 'risk'] },
  { id: 'nav-settings', label: 'Go to Settings', href: '/settings', icon: Settings, keywords: ['settings', 'preferences', 'config'] },
]

interface CommandPaletteProps {
  onClose: () => void
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  // Fetch incidents list
  const { data: incidents } = useQuery<Incident[]>({
    queryKey: ['incidents-palette'],
    queryFn: () => request('/incidents'),
  })

  // Fetch agents list
  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['agents-palette'],
    queryFn: () => api.getAgents(),
  })

  // Build commands
  const allCommands = useMemo(() => {
    const list = [...STATIC_COMMANDS]

    // Active incidents options
    if (incidents) {
      incidents.forEach((inc) => {
        // Open
        list.push({
          id: `open-inc-${inc.id}`,
          label: `Open Investigation: ${inc.agent_name} (${inc.trigger_type})`,
          href: `/investigation?id=${inc.id}`,
          action: 'navigate',
          icon: ScrollText,
          keywords: ['open', 'investigation', inc.id, inc.agent_name, inc.trigger_type, 'incident']
        })

        // Resolve
        if (inc.status !== 'RESOLVED') {
          list.push({
            id: `resolve-inc-${inc.id}`,
            label: `Resolve Incident: ${inc.agent_name} - ${inc.trigger_type}`,
            action: 'resolve',
            targetId: inc.id,
            icon: ShieldCheck,
            keywords: ['resolve', 'incident', inc.id, inc.agent_name]
          })
        }
      })
    }

    // Active agents options
    if (agents) {
      agents.forEach((agent) => {
        // Open
        list.push({
          id: `open-agent-${agent.id}`,
          label: `Open Fleet Agent: ${agent.name}`,
          href: `/fleet?id=${agent.id}`,
          action: 'navigate',
          icon: Bot,
          keywords: ['open', 'agent', agent.name, agent.role]
        })

        // Block/Quarantine
        if (agent.status === 'ACTIVE') {
          list.push({
            id: `quarantine-agent-${agent.id}`,
            label: `Quarantine Agent: ${agent.name}`,
            action: 'quarantine',
            targetId: agent.id,
            icon: ShieldCheck,
            keywords: ['quarantine', 'block', agent.name]
          })
        }
      })
    }

    // Demo Scenarios
    const scenarios = [
      { key: 'data_exfiltration', name: 'Data Exfiltration' },
      { key: 'privilege_escalation', name: 'Privilege Escalation' },
    ]
    scenarios.forEach((sc) => {
      list.push({
        id: `sc-${sc.key}`,
        label: `Trigger Demo Scenario: ${sc.name}`,
        action: 'scenario',
        targetId: sc.key,
        icon: Play,
        keywords: ['trigger', 'demo', 'scenario', sc.name]
      })
    })

    // Decoy HoneyTools
    const traps = ['download_customer_database', 'export_all_secrets', 'root_shell']
    traps.forEach((t) => {
      list.push({
        id: `trap-${t}`,
        label: `Activate Trap Simulation: ${t}()`,
        action: 'simulation',
        targetId: t,
        icon: Swords,
        keywords: ['activate', 'simulation', 'trap', t]
      })
    })

    return list
  }, [incidents, agents])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allCommands.slice(0, 10)
    return allCommands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.toLowerCase().includes(q))
    )
  }, [allCommands, query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const execute = async (item: CommandItem) => {
    if (item.action === 'resolve' && item.targetId) {
      try {
        await api.resolveIncident(item.targetId)
        queryClient.invalidateQueries({ queryKey: ['incidents'] })
        addToast({ message: `Incident marked as resolved`, variant: 'success' })
      } catch (err: any) {
        addToast({ message: err?.message || 'Resolution failed', variant: 'error' })
      }
    } else if (item.action === 'quarantine' && item.targetId) {
      try {
        await api.blockAgent(item.targetId)
        queryClient.invalidateQueries({ queryKey: ['agents'] })
        addToast({ message: `Agent quarantined`, variant: 'success' })
      } catch (err: any) {
        addToast({ message: err?.message || 'Quarantine failed', variant: 'error' })
      }
    } else if (item.action === 'scenario' && item.targetId) {
      try {
        await api.startScenario(item.targetId)
        addToast({ message: `Simulation scenario started`, variant: 'success' })
      } catch (err: any) {
        addToast({ message: err?.message || 'Simulation failed', variant: 'error' })
      }
    } else if (item.action === 'simulation' && item.targetId) {
      try {
        const activeAgent = agents?.find(a => a.status === 'ACTIVE')
        if (activeAgent) {
          await api.executeTool(activeAgent.id, item.targetId, {})
          queryClient.invalidateQueries({ queryKey: ['agents'] })
          addToast({ message: `Bait simulation executed`, variant: 'success' })
        } else {
          addToast({ message: `No active agent online for baiting`, variant: 'error' })
        }
      } catch (err: any) {
        addToast({ message: err?.message || 'Bait execution failed', variant: 'error' })
      }
    } else if (item.href) {
      navigate(item.href)
    }
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
      <div className="fixed inset-0 bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search pages..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none font-mono"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground font-mono">No command actions match query</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onClick={() => execute(item)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded px-3 py-2 text-xs transition-all text-left font-mono',
                  i === selectedIndex ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/10'
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <ArrowRight className={cn('h-3.5 w-3.5 shrink-0', i === selectedIndex ? 'opacity-100' : 'opacity-0')} />
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border px-3.5 py-2 text-[10px] text-muted-foreground flex items-center gap-4 bg-muted/5 font-mono">
          <span><kbd className="rounded border bg-background px-1">↑↓</kbd> Navigate</span>
          <span><kbd className="rounded border bg-background px-1">Enter</kbd> Execute</span>
          <span><kbd className="rounded border bg-background px-1">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
