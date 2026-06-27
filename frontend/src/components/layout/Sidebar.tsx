import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Shield, LayoutDashboard, Monitor, Activity, Network,
  AlertTriangle, FileText, ScrollText, Clock, GitBranch,
  Bot, Terminal, GitCompare, Gauge,
  ShieldCheck, Settings, Sliders, BarChart3, Share2,
  Clapperboard, SkipForward, Code,
  Swords, LogOut, ChevronRight, ChevronDown, Film, Eye,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/services/api'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: 'Command',
    items: [
      { href: '/command-center', label: 'Command Center', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/fleet', label: 'Fleet', icon: Bot },
      { href: '/investigation', label: 'Investigation', icon: FileText },
      { href: '/deception-center', label: 'Deception Center', icon: Shield },
    ],
  },
  {
    label: 'Governance',
    items: [
      { href: '/policies', label: 'Policies', icon: ShieldCheck },
      { href: '/operator-security', label: 'Operator Security', icon: Eye },
      { href: '/audit', label: 'Audit', icon: ScrollText },
    ],
  },
  {
    label: 'Simulation',
    items: [
      { href: '/simulation-center', label: 'Simulation Center', icon: Terminal },
      { href: '/demo-director', label: 'Demo Director', icon: Clapperboard },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/architecture', label: 'Architecture', icon: Network },
    ],
  },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const filteredSections = navSections
    .map((section) => {
      const items = section.items.filter((item) => {
        if (item.href === '/settings') return user?.role === 'admin'
        if (item.href === '/policies') return user?.role === 'admin' || user?.role === 'operator' || user?.role === 'engineer'
        if (item.href === '/operator-security') return user?.role === 'admin' || user?.role === 'operator' || user?.role === 'engineer' || user?.role === 'analyst'
        if (item.href === '/demo-director') return user?.role === 'admin' || user?.role === 'demo'
        if (item.href === '/simulation-center') return user?.role === 'admin' || user?.role === 'demo' || user?.role === 'analyst' || user?.role === 'operator' || user?.role === 'engineer'
        return true
      })
      return { ...section, items }
    })
    .filter((s) => s.items.length > 0)

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
    if (href === '/command-center') return location.pathname === '/command-center'
    return location.pathname.startsWith(href)
  }

  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen border-r border-border bg-background transition-transform duration-150 ease-in-out lg:translate-x-0 overflow-y-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'w-[280px]'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">AgentGuard</h1>
              <p className="text-[10px] text-muted-foreground">Runtime Security Firewall</p>
            </div>
          </div>

          <nav className="flex-1 py-3 px-3 space-y-1">
            {filteredSections.map((section) => {
              const sectionActive = section.items.some((item) => isActive(item.href))
              const collapsed = collapsedSections.has(section.label)
              return (
                <div key={section.label} className="mb-0.5">
                  <button
                    onClick={() => toggleSection(section.label)}
                    className={cn(
                      "flex w-full items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors rounded",
                      sectionActive && !collapsed && "text-foreground"
                    )}
                  >
                    {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {section.label}
                  </button>
                  {!collapsed && (
                    <div className="space-y-0.5 mt-0.5">
                      {section.items.map((item) => {
                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            onClick={onClose}
                            className={cn(
                              'flex items-center gap-2.5 rounded px-3 py-1.5 text-sm transition-colors',
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
              className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-sm transition-colors text-muted-foreground hover:text-danger hover:bg-danger/10 disabled:opacity-50"
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
              className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
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
