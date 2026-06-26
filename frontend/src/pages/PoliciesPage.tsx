import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Activity, ShieldCheck, AlertTriangle } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import type { Policy, Agent } from '@/types'

export function PoliciesPage() {
  const queryClient = useQueryClient()
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', allowed_tools: '', denied_tools: '', agent_id: '', role: '' })

  const { data: policies, isLoading } = useQuery<Policy[]>({ queryKey: ['policies'], queryFn: () => api.getPolicies() })
  const { data: agents } = useQuery<Agent[]>({ queryKey: ['agents'], queryFn: () => api.getAgents() })

  const createMutation = useMutation({
    mutationFn: () => api.createPolicy({
      name: form.name, description: form.description || undefined,
      allowed_tools: form.allowed_tools.split(',').map(s => s.trim()).filter(Boolean),
      denied_tools: form.denied_tools.split(',').map(s => s.trim()).filter(Boolean),
      agent_id: form.agent_id || undefined, role: form.role || undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['policies'] }); setShowCreate(false); setForm({ name: '', description: '', allowed_tools: '', denied_tools: '', agent_id: '', role: '' }) },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingPolicy) throw new Error('No policy selected')
      return api.updatePolicy(editingPolicy.id, {
        name: form.name || editingPolicy.name, description: form.description || editingPolicy.description || undefined,
        allowed_tools: form.allowed_tools ? form.allowed_tools.split(',').map(s => s.trim()).filter(Boolean) : editingPolicy.allowed_tools,
        denied_tools: form.denied_tools ? form.denied_tools.split(',').map(s => s.trim()).filter(Boolean) : editingPolicy.denied_tools,
        agent_id: form.agent_id || editingPolicy.agent_id || undefined, role: form.role || editingPolicy.role || undefined,
      })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['policies'] }); setEditingPolicy(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePolicy(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policies'] }),
  })

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-8 w-8 animate-spin text-primary" /></div>

  const openEdit = (policy: Policy) => {
    setEditingPolicy(policy)
    setForm({ name: policy.name, description: policy.description || '', allowed_tools: policy.allowed_tools.join(', '), denied_tools: policy.denied_tools.join(', '), agent_id: policy.agent_id || '', role: policy.role || '' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policies</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Manage access control policies</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Create Policy</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Policy</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-sm font-medium">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. ResearchAgent-Restricted" /></div>
              <div><label className="text-sm font-medium">Description</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Restrict research tools" /></div>
              <div><label className="text-sm font-medium">Allowed Tools</label><Input value={form.allowed_tools} onChange={(e) => setForm({ ...form, allowed_tools: e.target.value })} placeholder="web_search, read_file" /></div>
              <div><label className="text-sm font-medium">Denied Tools</label><Input value={form.denied_tools} onChange={(e) => setForm({ ...form, denied_tools: e.target.value })} placeholder="download_customer_database" /></div>
              <div><label className="text-sm font-medium">Apply to Agent</label><Select value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: e.target.value })} options={[{ value: '', label: 'All agents (no filter)' }, ...(agents || []).map((a) => ({ value: a.id, label: `${a.name} (${a.role})` }))]} className="w-full" /></div>
              <div><label className="text-sm font-medium">Role Filter</label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. research" /></div>
              <Button onClick={() => createMutation.mutate()} className="w-full gap-2" disabled={!form.name}><ShieldCheck className="h-4 w-4" /> Create Policy</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {policies?.map((policy) => (
          <div key={policy.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{policy.name}</h3>
                  <Badge variant={policy.is_active ? 'success' : 'outline'}>{policy.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                {policy.description && <p className="mt-1 text-sm text-muted-foreground">{policy.description}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(policy)}><Pencil className="h-4 w-4" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-danger"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-danger" /> Delete Policy</AlertDialogTitle>
                      <AlertDialogDescription>Are you sure you want to delete <strong>{policy.name}</strong>? This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(policy.id)} className="bg-danger hover:bg-danger/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><p className="mb-1 text-xs font-medium text-muted-foreground">Allowed Tools</p>
                <div className="flex flex-wrap gap-1">{policy.allowed_tools.length > 0 ? policy.allowed_tools.map((t) => (<Badge key={t} variant="success" className="font-mono text-[10px]">{t}</Badge>)) : <span className="text-xs text-muted-foreground">All tools allowed</span>}</div>
              </div>
              <div><p className="mb-1 text-xs font-medium text-muted-foreground">Denied Tools</p>
                <div className="flex flex-wrap gap-1">{policy.denied_tools.length > 0 ? policy.denied_tools.map((t) => (<Badge key={t} variant="danger" className="font-mono text-[10px]">{t}</Badge>)) : <span className="text-xs text-muted-foreground">No denied tools</span>}</div>
              </div>
            </div>
            {(policy.agent_id || policy.role) && (
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                {policy.agent_id && <span>Agent: {agents?.find(a => a.id === policy.agent_id)?.name ?? policy.agent_id.slice(0, 8)}</span>}
                {policy.role && <span>Role: {policy.role}</span>}
              </div>
            )}
          </div>
        ))}
        {(!policies || policies.length === 0) && <div className="text-center py-12 text-muted-foreground">No policies created</div>}
      </div>

      {editingPolicy && (
        <Dialog open={!!editingPolicy} onOpenChange={() => setEditingPolicy(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Policy</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-sm font-medium">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Allowed Tools</label><Input value={form.allowed_tools} onChange={(e) => setForm({ ...form, allowed_tools: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Denied Tools</label><Input value={form.denied_tools} onChange={(e) => setForm({ ...form, denied_tools: e.target.value })} /></div>
              <Button onClick={() => updateMutation.mutate()} className="w-full">Update</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
