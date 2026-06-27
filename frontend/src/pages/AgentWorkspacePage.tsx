import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Bot, Plus, ShieldOff, Trash2, Eye, Activity, Search,
  ShieldCheck, Clock, AlertTriangle, Terminal, Send, CheckCircle,
  XCircle, Zap, Swords
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import type { Agent, AgentDetail, BehaviorProfile, AuditLog } from '@/types'

type SortKey = 'name' | 'risk_score' | 'status' | 'role'
type SortDir = 'asc' | 'desc'
type WorkspaceTab = 'overview' | 'behavior' | 'permissions' | 'console'

interface ConsoleEntry {
  id: string; type: 'input' | 'output' | 'error'; content: string; toolName?: string; timestamp: string
  decision?: string; risk_score?: number; execution_time_ms?: number; is_honeytool?: boolean; response?: unknown
}

interface ToolDef {
  name: string; label: string; icon: any; args: { key: string; label: string; placeholder: string }[]; category: 'real' | 'honeytool'
}

const REAL_TOOLS: ToolDef[] = [
  { name: 'search_web', label: 'Search Web', icon: Search, args: [{ key: 'query', label: 'Query', placeholder: 'Enter search query...' }], category: 'real' },
  { name: 'read_file', label: 'Read File', icon: FileText, args: [{ key: 'path', label: 'Path', placeholder: 'sandbox/notes/research.txt' }], category: 'real' },
  { name: 'http_get', label: 'HTTP GET', icon: Globe, args: [{ key: 'url', label: 'URL', placeholder: 'https://example.com' }], category: 'real' },
]

const HONEYTOOLS: ToolDef[] = [
  { name: 'download_customer_database', label: 'Download Customer DB', icon: ShieldAlert, args: [], category: 'honeytool' },
  { name: 'export_all_secrets', label: 'Export All Secrets', icon: ShieldAlert, args: [], category: 'honeytool' },
  { name: 'root_shell', label: 'Root Shell', icon: ShieldAlert, args: [], category: 'honeytool' },
]

function Globe(props: any) { return <span className="text-muted-foreground mr-1" {...props}>🌐</span> }
function FileText(props: any) { return <span className="text-muted-foreground mr-1" {...props}>📄</span> }
function ShieldAlert(props: any) { return <span className="text-danger mr-1" {...props}>⚠️</span> }

export function AgentWorkspacePage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const activeAgentId = searchParams.get('id') || ''
  const selectedAgentId = activeAgentId || searchParams.get('agentId') || ''
  const queryTab = searchParams.get('tab') as WorkspaceTab | null
  const activeTab = queryTab || 'overview'

  const [showRegister, setShowRegister] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', role: '', capabilities: '' })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null)

  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1)

  // Console local states
  const [selectedTool, setSelectedTool] = useState<ToolDef | null>(null)
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({})
  const [consoleHistory, setConsoleHistory] = useState<ConsoleEntry[]>([])
  const [consoleRunning, setConsoleRunning] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  // Fleet query
  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.getAgents(),
    refetchInterval: 5000,
  })

  // Selected agent details queries
  const { data: agentDetails } = useQuery<AgentDetail>({
    queryKey: ['agent', selectedAgentId],
    queryFn: () => api.getAgent(selectedAgentId),
    enabled: !!selectedAgentId,
  })

  const { data: behavior } = useQuery<BehaviorProfile>({
    queryKey: ['agent-behavior', selectedAgentId],
    queryFn: () => api.getAgentBehavior(selectedAgentId),
    enabled: !!selectedAgentId,
  })

  const { data: behaviorProfileData } = useQuery({
    queryKey: ['behavior-profile-detail', selectedAgentId],
    queryFn: () => api.getAgentBehaviorProfile(selectedAgentId),
    enabled: !!selectedAgentId && activeTab === 'behavior',
  })

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ['agent-audit', selectedAgentId],
    queryFn: () => api.getAgentAudit(selectedAgentId),
    enabled: !!selectedAgentId,
  })

  const { data: effectivePerms } = useQuery({
    queryKey: ['effective-permissions', selectedAgentId],
    queryFn: () => api.getEffectivePermissions(selectedAgentId),
    enabled: !!selectedAgentId && activeTab === 'permissions',
  })

  const { data: contributors } = useQuery({
    queryKey: ['risk-contributors', selectedAgentId],
    queryFn: () => api.getRiskContributors(selectedAgentId),
    enabled: !!selectedAgentId,
  })

  const registerMutation = useMutation({
    mutationFn: () => api.registerAgent({
      name: newAgent.name,
      role: newAgent.role,
      capabilities: newAgent.capabilities.split(',').map((c) => c.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setNewAgent({ name: '', role: '', capabilities: '' })
      setShowRegister(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setDeleteTarget(null)
      if (selectedAgentId === deleteTarget?.id) {
        setSearchParams({ tab: activeTab })
      }
    },
  })

  const blockMutation = useMutation({
    mutationFn: (id: string) => api.blockAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['agent', selectedAgentId] })
    },
  })

  const unquarantineMutation = useMutation({
    mutationFn: (id: string) => api.unquarantineAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['agent', selectedAgentId] })
    },
  })

  // Filter & Sort Agents
  const filteredAgents = useMemo(() => {
    if (!agents) return []
    let list = [...agents]
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q))
    }
    if (statusFilter) {
      list = list.filter((a) => a.status === statusFilter)
    }
    list.sort((a, b) => {
      let aVal = a[sortKey]
      let bVal = b[sortKey]
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal)
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return list
  }, [agents, debouncedSearch, statusFilter, sortKey, sortDir])

  const openWorkspacePanel = (agentId: string) => {
    setSearchParams({ id: agentId, tab: activeTab })
  }

  const setWorkspaceTab = (tab: WorkspaceTab) => {
    if (selectedAgentId) {
      setSearchParams({ id: selectedAgentId, tab })
    }
  }

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        setFocusedRowIndex((prev) => Math.min(prev + 1, filteredAgents.length - 1))
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        setFocusedRowIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        if (focusedRowIndex >= 0 && filteredAgents[focusedRowIndex]) {
          e.preventDefault()
          openWorkspacePanel(filteredAgents[focusedRowIndex].id)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setSearchParams({ tab: activeTab })
        setFocusedRowIndex(-1)
      } else if (e.key === 'ArrowRight' && selectedAgentId) {
        e.preventDefault()
        const tabs: WorkspaceTab[] = ['overview', 'behavior', 'permissions', 'console']
        const currentIdx = tabs.indexOf(activeTab)
        const nextIdx = (currentIdx + 1) % tabs.length
        setWorkspaceTab(tabs[nextIdx])
      } else if (e.key === 'ArrowLeft' && selectedAgentId) {
        e.preventDefault()
        const tabs: WorkspaceTab[] = ['overview', 'behavior', 'permissions', 'console']
        const currentIdx = tabs.indexOf(activeTab)
        const prevIdx = (currentIdx - 1 + tabs.length) % tabs.length
        setWorkspaceTab(tabs[prevIdx])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredAgents, focusedRowIndex, selectedAgentId, activeTab])

  const handleExecuteConsole = async () => {
    if (!selectedTool || !selectedAgentId || consoleRunning) return
    setConsoleRunning(true)
    const runTimestamp = new Date().toLocaleTimeString()
    const inputCmd = `${selectedTool.name}(${JSON.stringify(toolArgs)})`

    setConsoleHistory((prev) => [
      ...prev,
      { id: `c-${Date.now()}`, type: 'input', content: inputCmd, timestamp: runTimestamp }
    ])

    try {
      const res = await api.executeTool(selectedAgentId, selectedTool.name, toolArgs)
      const outTimestamp = new Date().toLocaleTimeString()
      setConsoleHistory((prev) => [
        ...prev,
        {
          id: `c-${Date.now()}-out`,
          type: res.decision === 'ALLOWED' ? 'output' : 'error',
          content: res.reason || 'Executed successfully',
          toolName: selectedTool.name,
          timestamp: outTimestamp,
          decision: res.decision,
          risk_score: res.risk_score ?? undefined,
          execution_time_ms: res.execution_time_ms ?? undefined,
          is_honeytool: res.is_honeytool,
          response: res.result,
        }
      ])
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['agent', selectedAgentId] })
    } catch (err: any) {
      setConsoleHistory((prev) => [
        ...prev,
        { id: `c-${Date.now()}-err`, type: 'error', content: err?.message || 'Network execution error', timestamp: new Date().toLocaleTimeString() }
      ])
    } finally {
      setConsoleRunning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 text-sm animate-pulse">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <Skeleton className="h-8 w-32 bg-muted/20" />
            <Skeleton className="h-3.5 w-64 mt-1.5 bg-muted/20" />
          </div>
          <Skeleton className="h-8 w-24 bg-muted/20" />
        </div>
        <div className="grid grid-cols-12 gap-4 items-start">
          <div className="col-span-12 space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1 bg-muted/20" />
              <Skeleton className="h-8 w-24 bg-muted/20" />
            </div>
            <TableSkeleton rows={8} cols={4} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground font-mono">Fleet</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">Fleet-wide status monitoring, runtime boundaries, and sandbox tool execution</p>
        </div>
        <Dialog open={showRegister} onOpenChange={setShowRegister}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/95 text-white text-xs h-8 gap-1.5 font-mono">
              <Plus className="h-3.5 w-3.5" /> Register Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-card border text-sm">
            <DialogHeader><DialogTitle className="text-base font-semibold">Register New Agent</DialogTitle></DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Agent Name</label>
                <Input value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="ResearchAgent-01" className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Role / Scope</label>
                <Input value={newAgent.role} onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })} placeholder="research" className="h-9 font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Capabilities (Comma-separated)</label>
                <Input value={newAgent.capabilities} onChange={(e) => setNewAgent({ ...newAgent, capabilities: e.target.value })} placeholder="search_web, read_file" className="h-9" />
              </div>
              <Button onClick={() => registerMutation.mutate()} disabled={!newAgent.name || !newAgent.role} className="w-full bg-primary hover:bg-primary/90 mt-2 h-9 text-xs">
                {registerMutation.isPending ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Split-Pane Layout Grid */}
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* Left Side: Agent List Pane (col-span-12 -> Full table view) */}
        <div className="col-span-12 space-y-3.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents or roles... (J/K to navigate, Enter to inspect)"
                className="pl-8 h-8 text-xs bg-card font-mono"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-card border rounded px-2 h-8 text-xs focus:ring-1 font-mono"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="QUARANTINED">QUARANTINED</option>
            </select>
          </div>

          <div className="rounded border bg-card overflow-hidden">
            <div className="px-3.5 py-2 border-b bg-muted/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">Fleet Registry</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b bg-muted/20 text-muted-foreground font-semibold">
                    <th className="px-3 py-2 cursor-pointer hover:bg-muted/30" onClick={() => { setSortKey('name'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }}>Agent</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2 text-right cursor-pointer hover:bg-muted/30" onClick={() => { setSortKey('risk_score'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }}>Risk</th>
                    <th className="px-3 py-2 text-right">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filteredAgents.map((agent, idx) => {
                    const active = selectedAgentId === agent.id
                    const focused = focusedRowIndex === idx
                    return (
                      <tr
                        key={agent.id}
                        onClick={() => openWorkspacePanel(agent.id)}
                        className={cn(
                          'cursor-pointer hover:bg-muted/10 transition-colors',
                          active && 'bg-primary/5 hover:bg-primary/5',
                          focused && 'bg-muted/20 ring-1 ring-primary/40'
                        )}
                        title={`Allowed Capabilities: ${agent.capabilities?.join(', ') || 'none'}`}
                      >
                        <td className="px-3 py-2.5 font-medium flex items-center gap-1.5">
                          <StatusIndicator status={agent.status === 'ACTIVE' ? 'active' : agent.status === 'BLOCKED' ? 'danger' : 'warning'} />
                          <span className="truncate">{agent.name}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{agent.role}</td>
                        <td className={cn("px-3 py-2.5 text-right font-bold", agent.risk_score > 80 ? 'text-danger' : agent.risk_score > 50 ? 'text-warning' : 'text-success')}>
                          {agent.risk_score.toFixed(0)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Badge variant={agent.status === 'ACTIVE' ? 'success' : 'danger'} className="text-[8px] font-mono leading-none tracking-wide">
                            {agent.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredAgents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-muted-foreground">No agents match criteria</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over contextual details inspector panel drawer (Linear/GitHub-style) */}
      <AnimatePresence>
        {selectedAgentId && agentDetails && (
          <>
            {/* Backdrop opacity dim */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs"
              onClick={() => {
                setSearchParams({ tab: activeTab })
                setFocusedRowIndex(-1)
              }}
            />
            {/* Slide-over inspector panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 220 }}
              className="fixed right-0 top-0 h-screen w-[580px] bg-card border-l border-border shadow-2xl z-50 overflow-hidden flex flex-col font-mono"
            >
              {/* Header Details Panel */}
              <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/10 shrink-0">
                <div className="flex items-center gap-2">
                  <Bot className={cn('h-5 w-5', agentDetails.status === 'ACTIVE' ? 'text-success' : 'text-danger')} />
                  <div>
                    <h2 className="text-sm font-semibold">{agentDetails.name}</h2>
                    <p className="text-[10px] text-muted-foreground font-mono">ID: {agentDetails.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {agentDetails.status === 'ACTIVE' ? (
                    <Button size="sm" variant="outline" className="text-warning gap-1 h-7 text-[11px]" onClick={() => blockMutation.mutate(agentDetails.id)}>
                      <ShieldOff className="h-3 w-3" /> Block
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-success gap-1 h-7 text-[11px]" onClick={() => unquarantineMutation.mutate(agentDetails.id)}>
                      <ShieldCheck className="h-3 w-3" /> Restore
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2" onClick={() => setDeleteTarget(agentDetails)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Workspace Navigation Tabs */}
              <div className="flex border-b px-2 bg-muted/5 text-xs overflow-x-auto shrink-0">
                {([
                  { id: 'overview', label: 'Overview', icon: Eye },
                  { id: 'behavior', label: 'Behavior Analysis', icon: Activity },
                  { id: 'permissions', label: 'Permissions DSL', icon: ShieldCheck },
                  { id: 'console', label: 'Diagnostic Terminal', icon: Terminal },
                ] as const).map((t) => {
                  const Icon = t.icon
                  const active = activeTab === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setWorkspaceTab(t.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors whitespace-nowrap',
                        active ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  )
                })}
              </div>

              {/* Details Sub-Panels */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0">
                {activeTab === 'overview' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="border rounded p-3 bg-muted/10">
                        <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Scope Role</span>
                        <p className="text-sm font-semibold mt-1">{agentDetails.role}</p>
                      </div>
                      <div className="border rounded p-3 bg-muted/10">
                        <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Risk Score</span>
                        <p className={cn('text-sm font-bold mt-1', agentDetails.risk_score > 85 ? 'text-danger' : agentDetails.risk_score > 50 ? 'text-warning' : 'text-success')}>{agentDetails.risk_score.toFixed(1)}</p>
                      </div>
                      <div className="border rounded p-3 bg-muted/10">
                        <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Last Telemetry</span>
                        <p className="text-xs font-semibold mt-1.5">{agentDetails.last_seen ? new Date(agentDetails.last_seen).toLocaleTimeString() : 'Never'}</p>
                      </div>
                    </div>

                    <div className="border rounded p-3.5 space-y-2 bg-card">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase">Registered Capabilities</h4>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {agentDetails.capabilities.map((c) => (
                          <Badge key={c} variant="outline" className="font-mono text-[9px]">{c}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="border rounded p-3.5 space-y-3 bg-card">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase">Risk Evaluation Breakdown</h4>
                      {contributors && contributors.length > 0 ? (
                        <div className="space-y-2">
                          {contributors.map((contrib: any) => (
                            <div key={contrib.id || contrib.contributor} className="flex justify-between items-center text-xs border-b border-border/40 pb-1.5">
                              <span className="text-muted-foreground font-medium">{contrib.reason || contrib.contributor}</span>
                              <span className="font-mono font-bold text-danger">+{contrib.score_delta.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No active risk penalties evaluated for this identity.</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'behavior' && behavior && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="border rounded p-2.5 bg-muted/15">
                        <span className="text-muted-foreground text-[10px] uppercase">Calls (1h)</span>
                        <p className="text-sm font-bold font-mono mt-0.5">{behavior.tool_frequency_1h}</p>
                      </div>
                      <div className="border rounded p-2.5 bg-muted/15">
                        <span className="text-muted-foreground text-[10px] uppercase">Calls (24h)</span>
                        <p className="text-sm font-bold font-mono mt-0.5">{behavior.tool_frequency_24h}</p>
                      </div>
                      <div className="border rounded p-2.5 bg-muted/15">
                        <span className="text-muted-foreground text-[10px] uppercase">Tool Diversity</span>
                        <p className="text-sm font-bold font-mono mt-0.5">{behavior.tool_diversity_24h}</p>
                      </div>
                      <div className="border rounded p-2.5 bg-muted/15">
                        <span className="text-muted-foreground text-[10px] uppercase">Denied Requests</span>
                        <p className="text-sm font-bold font-mono text-danger mt-0.5">{behavior.denied_requests_24h}</p>
                      </div>
                    </div>

                    <div className="border rounded p-3.5 bg-card">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Tool call telemetry</h4>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={Object.entries(behaviorProfileData?.tool_counts || {}).map(([name, count]) => ({ name, count }))}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F2937" />
                            <XAxis dataKey="name" stroke="#6B7280" fontSize={9} />
                            <YAxis stroke="#6B7280" fontSize={9} />
                            <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937' }} />
                            <Bar dataKey="count" fill="#2563EB" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'permissions' && effectivePerms && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="border rounded p-3.5 bg-card">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Effective Access Whitelist</h4>
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {effectivePerms.allowed_tools?.map((tool: string) => (
                          <Badge key={tool} variant="success" className="font-mono text-[9px] tracking-wide font-bold">{tool}</Badge>
                        ))}
                        {effectivePerms.allowed_tools?.length === 0 && <p className="text-xs text-muted-foreground">All tool calls are denied by default.</p>}
                      </div>
                    </div>

                    <div className="border rounded p-3.5 bg-card">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2.5">Custom Policy DSL Rules</h4>
                      {effectivePerms.policy?.custom_dsl ? (
                        <pre className="p-3 bg-black/40 text-xs font-mono rounded text-purple-300 border overflow-x-auto whitespace-pre-wrap">{effectivePerms.policy.custom_dsl}</pre>
                      ) : (
                        <p className="text-xs text-muted-foreground">No custom DSL filters configured. Falling back to default role permission whitelist.</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'console' && (
                  <div className="flex-1 flex flex-col border rounded bg-card min-h-[420px] overflow-hidden animate-in fade-in duration-200">
                    <div className="px-3 py-2 border-b bg-muted/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sandboxed Session Terminal</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedTool && selectedTool.args.length > 0 && (
                          <div className="flex items-center gap-1">
                            {selectedTool.args.map((arg) => (
                              <Input
                                key={arg.key}
                                value={toolArgs[arg.key] || ''}
                                onChange={(e) => setToolArgs((prev) => ({ ...prev, [arg.key]: e.target.value }))}
                                placeholder={arg.placeholder}
                                className="w-36 h-6 text-[10px] font-mono bg-background"
                                onKeyDown={(e) => e.key === 'Enter' && handleExecuteConsole()}
                              />
                            ))}
                            <Button onClick={handleExecuteConsole} disabled={agentDetails.status !== 'ACTIVE' || consoleRunning || selectedTool.args.some((a) => !toolArgs[a.key]?.trim())} size="sm" className="bg-primary hover:bg-primary/90 h-6 px-2 text-[10px] gap-1">
                              {consoleRunning ? <Activity className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />} Run
                            </Button>
                          </div>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setConsoleHistory([])} className="h-6 px-1.5 text-muted-foreground"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-12 min-h-0">
                      {/* Left tool picker list */}
                      <div className="col-span-4 border-r p-2.5 space-y-2.5 overflow-y-auto max-h-[350px]">
                        <div>
                          <p className="text-[9px] font-bold text-muted-foreground mb-1 flex items-center gap-1 uppercase">API Tools</p>
                          <div className="flex flex-col gap-0.5">
                            {REAL_TOOLS.map((tool) => {
                              const active = selectedTool?.name === tool.name
                              return (
                                <button key={tool.name} onClick={() => { setSelectedTool(tool); setToolArgs({}) }}
                                  className={cn('flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono text-left', active ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20')}>
                                  <span>⚙️</span><span>{tool.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-danger mb-1 flex items-center gap-1 uppercase">Deception traps</p>
                          <div className="flex flex-col gap-0.5">
                            {HONEYTOOLS.map((tool) => {
                              const active = selectedTool?.name === tool.name
                              return (
                                <button key={tool.name} onClick={() => { setSelectedTool(tool); setToolArgs({}) }}
                                  className={cn('flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono text-left', active ? 'bg-danger/10 text-danger font-bold' : 'text-danger/60 hover:text-danger hover:bg-danger/5')}>
                                  <span>⚠️</span><span>{tool.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Right terminal scroll screen */}
                      <div className="col-span-8 bg-black/40 p-3 font-mono text-[10px] space-y-2 overflow-y-auto max-h-[350px] scrollbar-thin">
                        {consoleHistory.length === 0 && (
                          <div className="flex h-full items-center justify-center text-muted-foreground/60 text-center py-10">
                            <div><Terminal className="mx-auto h-4 w-4 mb-1 opacity-30" /><p className="text-[10px]">Select a tool capability to execute sandboxed evaluation logs.</p></div>
                          </div>
                        )}
                        {consoleHistory.map((entry) => (
                          <div key={entry.id} className="space-y-1">
                            {entry.type === 'input' ? (
                              <div className="text-primary flex items-start gap-1"><span className="text-muted-foreground shrink-0">[{entry.timestamp}]</span><span className="opacity-50">&gt;</span><span>{entry.content}</span></div>
                            ) : entry.type === 'error' ? (
                              <div className="text-danger flex items-start gap-1"><span className="text-muted-foreground shrink-0">[{entry.timestamp}]</span><span>[ERR]</span><span>{entry.content}</span></div>
                            ) : (
                              <div className="flex items-start gap-1 text-muted-foreground">
                                <span className="text-muted-foreground shrink-0">[{entry.timestamp}]</span>
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={entry.decision === 'ALLOWED' ? 'text-success font-semibold' : 'text-danger font-bold'}>{entry.decision}</span>
                                    {entry.execution_time_ms !== undefined && <span className="text-muted-foreground">{entry.execution_time_ms.toFixed(0)}ms</span>}
                                    {entry.risk_score !== undefined && <span className="text-muted-foreground">Risk: {entry.risk_score.toFixed(0)}</span>}
                                  </div>
                                  <p className="text-foreground mt-0.5">{entry.content}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card text-sm border font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold">Delete Agent</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">Are you sure you want to unregister <strong>{deleteTarget?.name}</strong>? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-danger hover:bg-danger/90 h-8 text-xs" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
