import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Shield, LayoutDashboard, Bot, ShieldCheck, ScrollText, AlertTriangle,
  Activity, Settings, LogOut, Swords, Terminal, Brain, GitCompare, Network,
  Monitor, SkipForward, Clapperboard, FileText, Clock, GitBranch,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/services/api'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface NavSection {
  label: string
  items: { href: string; label: string; icon: typeof LayoutDashboard }[]
}

const navSections: NavSection[] = [
  {
    label: 'Monitor',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/live', label: 'Live Logs', icon: Terminal },
      { href: '/system-health', label: 'System Health', icon: Activity },
      { href: '/threat-graph', label: 'Threat Graph', icon: Network },
    ],
  },
  {
    label: 'Security',
    items: [
      { href: '/incidents', label: 'Incidents', icon: FileText },
      { href: '/risk-events', label: 'Risk Events', icon: AlertTriangle },
      { href: '/risk-timeline', label: 'Risk Timeline', icon: GitBranch },
      { href: '/forensic', label: 'Forensic Timeline', icon: Clock },
      { href: '/anomaly', label: 'Anomaly Detection', icon: Brain },
      { href: '/audit', label: 'Audit Trail', icon: ScrollText },
    ],
  },
  {
    label: 'Agents',
    items: [
      { href: '/agents', label: 'All Agents', icon: Bot },
      { href: '/console', label: 'Agent Console', icon: Monitor },
      { href: '/compare', label: 'Agent Comparison', icon: GitCompare },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { href: '/policies', label: 'Policies', icon: ShieldCheck },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'Demos',
    items: [
      { href: '/demo-director', label: 'Demo Director', icon: Clapperboard },
      { href: '/scenarios', label: 'Attack Scenarios', icon: SkipForward },
    ],
  },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const simulateAttack = async () => {
    if (simulating) return
    setSimulating(true)
    setSimResult(null)
    try {
      const agents = await api.getAgents()
      const target = agents.find((a) => a.status === 'ACTIVE') || agents[0]
      if (!target) {
        setSimResult('No agents available')
        setSimulating(false)
        return
      }
      const honeytools = ['download_customer_database', 'export_all_secrets', 'root_shell']
      const tool = honeytools[Math.floor(Math.random() * honeytools.length)]
      const result = await api.executeTool(target.id, tool)
      setSimResult(`${target.name}: ${tool} → ${result.decision} (risk ${result.risk_score.toFixed(0)})`)
    } catch (e: any) {
      setSimResult(e?.message || 'Simulation failed')
    } finally {
      setSimulating(false)
      setTimeout(() => setSimResult(null), 8000)
    }
    onClose()
  }

  const toggleSection = (label: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(href)
  }

  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-56 border-r border-border bg-card transition-transform duration-150 ease-in-out lg:translate-x-0 overflow-y-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">AgentGuard</h1>
              <p className="text-[10px] text-muted-foreground">Runtime Security Firewall</p>
            </div>
          </div>

          <nav className="flex-1 py-2 px-2 space-y-0.5">
            {navSections.map((section) => {
              const sectionActive = section.items.some((item) => isActive(item.href))
              const collapsed = collapsedSections.has(section.label)
              return (
                <div key={section.label} className="mb-1">
                  <button
                    onClick={() => toggleSection(section.label)}
                    className={cn(
                      "flex w-full items-center gap-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors rounded",
                      sectionActive && !collapsed && "text-foreground"
                    )}
                  >
                    {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {section.label}
                  </button>
                  {!collapsed && (
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            onClick={onClose}
                            className={cn(
                              'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                              active
                                ? 'bg-accent text-foreground font-medium'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          <div className="border-t border-border p-3 space-y-1.5">
            <button
              onClick={simulateAttack}
              disabled={simulating}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors text-muted-foreground hover:text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              <Swords className={`h-4 w-4 shrink-0 ${simulating ? 'animate-spin' : ''}`} />
              {simulating ? 'Simulating...' : 'Simulate Attack'}
            </button>
            {simResult && (
              <div className="px-3 py-2 mt-1 rounded bg-danger/10 border border-danger/20">
                <p className="text-xs text-danger/90 break-words">{simResult}</p>
              </div>
            )}
            <button
              onClick={() => { logout(); onClose() }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
