import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Activity, Database, Save, RotateCcw, Palette } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { Settings } from '@/types'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings'], queryFn: () => api.getSettings(), refetchInterval: 30000,
  })
  const [edits, setEdits] = useState<Partial<Settings>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings?.active_palette) document.documentElement.setAttribute('data-palette', settings.active_palette)
  }, [settings?.active_palette])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => api.updateSettings(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); setEdits({}); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Activity className="h-8 w-8 animate-spin text-primary" /></div>

  const current = { ...settings, ...edits } as Settings

  const field = (label: string, key: keyof Settings, type = 'number') => (
    <div className="flex items-center justify-between rounded-lg bg-muted/20 p-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Input type={type} value={String((key in edits ? edits : settings)?.[key] ?? '')}
          onChange={(e) => { const val = type === 'number' ? Number(e.target.value) : e.target.value; setEdits((prev) => ({ ...prev, [key]: val })) }}
          className="w-24 h-8 text-xs font-mono text-right" />
        {(edits as any)[key] !== undefined && (edits as any)[key] !== (settings as any)?.[key] && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { const next = { ...edits }; delete (next as any)[key]; setEdits(next) }}><RotateCcw className="h-3 w-3" /></Button>
        )}
      </div>
    </div>
  )

  const toggleField = (label: string, key: keyof Settings) => (
    <div className="flex items-center justify-between rounded-lg bg-muted/20 p-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => setEdits((prev) => ({ ...prev, [key]: !current[key] }))}
          className={`relative h-6 w-11 rounded-full transition-colors ${current[key] ? 'bg-success' : 'bg-muted'}`}>
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${current[key] ? 'translate-x-5' : ''}`} />
        </button>
        <Badge variant={current[key] ? 'success' : 'default'} className="w-16 justify-center">{current[key] ? 'ON' : 'OFF'}</Badge>
      </div>
    </div>
  )

  const hasChanges = Object.keys(edits).length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">System configuration</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-success">Saved</span>}
          <Button variant="default" size="sm" className="gap-2" disabled={!hasChanges || updateMutation.isPending} onClick={() => updateMutation.mutate(edits)}>
            <Save className="h-4 w-4" />{updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Security</h3>
          <div className="space-y-2">{field('Containment Threshold', 'containment_threshold')}{field('Decoy Tool Penalty', 'decoy_tool_penalty')}{field('Denied Call Penalty', 'denied_call_penalty')}{field('Rate Limit (per min)', 'rate_limit_per_minute')}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-warning" /> Detection</h3>
          <div className="space-y-2">{field('Rapid Burst Penalty', 'rapid_burst_penalty')}{field('Privilege Escalation Penalty', 'privilege_escalation_penalty')}{field('Anomaly Contamination', 'anomaly_contamination')}{toggleField('Demo Mode', 'demo_mode')}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Theme</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-muted/20 p-3">
              <span className="text-sm">Color Palette</span>
              <Select value={(edits.active_palette !== undefined ? edits : settings)?.active_palette || 'cyberpunk'}
                onChange={(e) => setEdits((prev) => ({ ...prev, active_palette: e.target.value }))}
                options={(settings?.available_palettes || []).map((p) => ({ value: p.id, label: p.name }))} className="w-40" />
            </div>
            <div className="flex gap-2 px-1">
              {(settings?.available_palettes || []).map((p) => {
                const active = (edits.active_palette !== undefined ? edits : settings)?.active_palette === p.id
                const hue = p.primary.split(' ')[0]
                return <button key={p.id} onClick={() => setEdits((prev) => ({ ...prev, active_palette: p.id }))}
                  className={`flex-1 h-10 rounded-lg border-2 transition-all ${active ? 'border-foreground scale-105' : 'border-border'}`}
                  style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }} title={p.name} />
              })}
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> System Info</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-muted/20 p-3"><span className="text-sm">Version</span><span className="font-mono text-sm">1.0.0</span></div>
            <div className="flex items-center justify-between rounded-lg bg-muted/20 p-3"><span className="text-sm">App Name</span><span className="font-mono text-sm">{current.app_name}</span></div>
            <div className="flex items-center justify-between rounded-lg bg-muted/20 p-3"><span className="text-sm">Database</span><span className="font-mono text-sm">PostgreSQL</span></div>
            <div className="flex items-center justify-between rounded-lg bg-muted/20 p-3"><span className="text-sm">Cache</span><span className="font-mono text-sm">Redis</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
