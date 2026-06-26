import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bot, Plus, ShieldOff, Trash2, Eye, Activity, Search, LayoutGrid, List, ShieldCheck, AlertTriangle, Gauge, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { StatCard } from '@/components/layout/StatCard'
import type { Agent } from '@/types'

type SortKey = 'name' | 'risk_score' | 'status' | 'role'
type SortDir = 'asc' | 'desc'

export function AgentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showRegister, setShowRegister] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', role: '', capabilities: '' })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null)

  const searchTimer = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>
    return (val: string) => {
      clearTimeout(timer)
      timer = setTimeout(() => setDebouncedSearch(val), 250)
    }
  }, [])

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.getAgents(),
    refetchInterval: 5000,
  })

  const registerMutation = useMutation({
    mutationFn: () => api.registerAgent({
      name: newAgent.name,
      role: newAgent.role,
      capabilities: newAgent.capabilities.split(',').map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setShowRegister(false)
      setNewAgent({ name: '', role: '', capabilities: '' })
    },
  })

  const blockMutation = useMutation({
    mutationFn: (id: string) => api.blockAgent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })

  const unquarantineMutation = useMutation({
    mutationFn: (id: string) => api.unquarantineAgent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setDeleteTarget(null)
    },
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortHeader = ({ label, sortField }: { label: string; sortField: SortKey }) => (
    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(sortField)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortField ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  )

  const filteredAgents = useMemo(() => {
    if (!agents) return []
    let result = agents
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase()
      result = result.filter((a) => a.name.toLowerCase().includes(s) || a.role.toLowerCase().includes(s) || a.id.toLowerCase().includes(s))
    }
    if (statusFilter) result = result.filter((a) => a.status === statusFilter)
    result.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'risk_score') cmp = a.risk_score - b.risk_score
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortKey === 'role') cmp = a.role.localeCompare(b.role)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [agents, debouncedSearch, statusFilter, sortKey, sortDir])

  const stats = useMemo(() => {
    if (!agents) return { total: 0, active: 0, blocked: 0, quarantined: 0, avgRisk: 0 }
    const active = agents.filter((a) => a.status === 'ACTIVE').length
    const blocked = agents.filter((a) => a.status === 'BLOCKED').length
    const quarantined = agents.filter((a) => a.status === 'QUARANTINED').length
    const avgRisk = agents.reduce((sum, a) => sum + a.risk_score, 0) / (agents.length || 1)
    return { total: agents.length, active, blocked, quarantined, avgRisk: avgRisk.toFixed(1) }
  }, [agents])

  if (isLoading) {
    return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{stats.total} registered agents</p>
        </div>
        <Dialog open={showRegister} onOpenChange={setShowRegister}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Register Agent</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register New Agent</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-sm font-medium">Agent Name</label><Input value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="ResearchAgent" /></div>
              <div><label className="text-sm font-medium">Role</label><Input value={newAgent.role} onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })} placeholder="research" /></div>
              <div><label className="text-sm font-medium">Capabilities (comma-separated)</label><Input value={newAgent.capabilities} onChange={(e) => setNewAgent({ ...newAgent, capabilities: e.target.value })} placeholder="web_search, read_file, analyze" /></div>
              <Button onClick={() => registerMutation.mutate()} disabled={!newAgent.name || !newAgent.role || registerMutation.isPending} className="w-full">
                {registerMutation.isPending ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Total" value={stats.total} icon={<Bot className="h-5 w-5" />} />
        <StatCard title="Active" value={stats.active} icon={<ShieldCheck className="h-5 w-5" />} variant="success" />
        <StatCard title="Blocked" value={stats.blocked} icon={<ShieldOff className="h-5 w-5" />} variant="danger" />
        <StatCard title="Avg Risk" value={`${stats.avgRisk}%`} icon={<Gauge className="h-5 w-5" />} variant={Number(stats.avgRisk) > 50 ? 'warning' : 'default'} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); searchTimer(e.target.value) }} placeholder="Search agents..." className="pl-10" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[
          { value: '', label: 'All Statuses' }, { value: 'ACTIVE', label: 'Active' }, { value: 'BLOCKED', label: 'Blocked' }, { value: 'QUARANTINED', label: 'Quarantined' },
        ]} className="w-full sm:w-40" />
        <div className="flex gap-1 rounded-lg border p-1">
          <button onClick={() => setViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}><List className="h-4 w-4" /></button>
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}><LayoutGrid className="h-4 w-4" /></button>
        </div>
      </div>

      {filteredAgents.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground"><Bot className="mx-auto h-8 w-8 mb-2 opacity-50" /><p>No agents match your filters</p></div>
      ) : viewMode === 'table' ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/20">
                  <SortHeader label="Agent" sortField="name" />
                  <SortHeader label="Role" sortField="role" />
                  <SortHeader label="Risk" sortField="risk_score" />
                  <SortHeader label="Status" sortField="status" />
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Capabilities</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.map((agent) => (
                  <tr key={agent.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${agent.status === 'ACTIVE' ? 'bg-success/10' : agent.status === 'BLOCKED' ? 'bg-danger/10' : 'bg-warning/10'}`}>
                          <Bot className={`h-4 w-4 ${agent.status === 'ACTIVE' ? 'text-success' : agent.status === 'BLOCKED' ? 'text-danger' : 'text-warning'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">ID: {agent.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge variant="info" className="font-mono text-[10px]">{agent.role}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-12 sm:w-16 rounded-full bg-secondary overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${agent.risk_score > 80 ? 'bg-danger' : agent.risk_score > 50 ? 'bg-warning' : agent.risk_score > 30 ? 'bg-warning/60' : 'bg-success'}`} style={{ width: `${agent.risk_score}%` }} />
                        </div>
                        <span className={`text-xs font-mono ${agent.risk_score > 80 ? 'text-danger' : agent.risk_score > 50 ? 'text-warning' : 'text-muted-foreground'}`}>{agent.risk_score.toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={agent.status === 'ACTIVE' ? 'success' : agent.status === 'BLOCKED' ? 'danger' : 'warning'}>{agent.status}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {agent.capabilities.slice(0, 3).map((c) => (<Badge key={c} variant="outline" className="font-mono text-[9px]">{c}</Badge>))}
                        {agent.capabilities.length > 3 && <span className="text-[9px] text-muted-foreground">+{agent.capabilities.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/agents/${agent.id}`)}><Eye className="h-4 w-4" /></Button>
                        {agent.status === 'ACTIVE' && <Button variant="ghost" size="sm" onClick={() => blockMutation.mutate(agent.id)} className="text-warning hover:text-warning"><ShieldOff className="h-4 w-4" /></Button>}
                        {(agent.status === 'BLOCKED' || agent.status === 'QUARANTINED') && <Button variant="ghost" size="sm" onClick={() => unquarantineMutation.mutate(agent.id)} className="text-success hover:text-success"><ShieldCheck className="h-4 w-4" /></Button>}
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(agent)} className="text-danger hover:text-danger"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <div key={agent.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${agent.status === 'ACTIVE' ? 'bg-success/10' : agent.status === 'BLOCKED' ? 'bg-danger/10' : 'bg-warning/10'}`}>
                    <Bot className={`h-5 w-5 ${agent.status === 'ACTIVE' ? 'text-success' : agent.status === 'BLOCKED' ? 'text-danger' : 'text-warning'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <Badge variant="info" className="font-mono text-[9px] mt-0.5">{agent.role}</Badge>
                  </div>
                </div>
                <Badge variant={agent.status === 'ACTIVE' ? 'success' : agent.status === 'BLOCKED' ? 'danger' : 'warning'}>{agent.status}</Badge>
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Risk Score</span>
                  <span className={`font-mono ${agent.risk_score > 80 ? 'text-danger' : agent.risk_score > 50 ? 'text-warning' : 'text-success'}`}>{agent.risk_score.toFixed(0)}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full ${agent.risk_score > 80 ? 'bg-danger' : agent.risk_score > 50 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${agent.risk_score}%` }} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {agent.capabilities.map((c) => (<Badge key={c} variant="outline" className="font-mono text-[9px]">{c}</Badge>))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="default" className="flex-1 gap-1" onClick={() => navigate(`/agents/${agent.id}`)}><Eye className="h-3.5 w-3.5" /> View</Button>
                {agent.status === 'ACTIVE' && <Button size="sm" variant="outline" className="text-warning gap-1" onClick={() => blockMutation.mutate(agent.id)}><ShieldOff className="h-3.5 w-3.5" /> Block</Button>}
                {(agent.status === 'BLOCKED' || agent.status === 'QUARANTINED') && <Button size="sm" variant="outline" className="text-success gap-1" onClick={() => unquarantineMutation.mutate(agent.id)}><ShieldCheck className="h-3.5 w-3.5" /> Unquarantine</Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-danger hover:bg-danger/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
