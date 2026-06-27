import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Bot, Link2, Link2Off, Plus, X, ArrowUpDown, ShieldCheck, ShieldAlert, Clock, Activity } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/PageHeader'
import { GraphSkeleton } from '@/components/ui/Skeleton'
import { useToastStore } from '@/store/toast'
import { cn } from '@/lib/utils'
import type { Agent } from '@/types'

interface TrustNode {
  id: string; x: number; y: number; vx: number; vy: number
  name: string; role: string; status: string; risk_score: number
}

interface TrustEdge {
  source: string; target: string; relationship: string; trust_level: number
}

export function TrustGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [parentId, setParentId] = useState('')
  const [childId, setChildId] = useState('')
  const [relationship, setRelationship] = useState('delegates')
  const [trustLevel, setTrustLevel] = useState(1)
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const { data: agents } = useQuery<Agent[]>({ queryKey: ['agents'], queryFn: () => api.getAgents() })
  const { data: graphData, isLoading } = useQuery({
    queryKey: ['trust-graph'],
    queryFn: () => api.getTrustGraph(),
    refetchInterval: 10000,
  })

  const createEdge = useMutation({
    mutationFn: () => api.createTrustEdge({ parent_agent_id: parentId, child_agent_id: childId, relationship, trust_level: trustLevel }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trust-graph'] }); setShowCreatePanel(false); addToast({ message: 'Trust edge created', variant: 'success' }) },
  })

  const deleteEdge = useMutation({
    mutationFn: (edgeId: string) => api.deleteTrustEdge(edgeId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trust-graph'] }); addToast({ message: 'Trust edge revoked', variant: 'info' }) },
  })

  const { nodes: gNodes, edges: gEdges } = useMemo(() => {
    const nodes: TrustNode[] = (graphData?.nodes || []).map((n: any, i: number) => ({
      id: n.id, x: 120 + (i % 5) * 140, y: 100 + Math.floor(i / 5) * 120,
      vx: 0, vy: 0, name: n.name, role: n.role, status: n.status, risk_score: n.risk_score,
    }))
    return { nodes, edges: (graphData?.edges || []) as TrustEdge[] }
  }, [graphData])

  const nodeMap = useMemo(() => {
    const m = new Map<string, TrustNode>()
    gNodes.forEach((n) => m.set(n.id, n))
    return m
  }, [gNodes])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.fillRect(0, 0, W, H)

    gNodes.forEach((n) => {
      n.x += n.vx; n.y += n.vy
      n.x = Math.max(40, Math.min(W - 40, n.x))
      n.y = Math.max(40, Math.min(H - 40, n.y))
      n.vx *= 0.9; n.vy *= 0.9
    })

    gNodes.forEach((a) => {
      gNodes.forEach((b) => {
        if (a.id >= b.id) return
        const dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
        if (dist > 200) return
        const force = (200 - dist) / dist * 0.015
        a.vx -= (dx / dist) * force; a.vy -= (dy / dist) * force
        b.vx += (dx / dist) * force; b.vy += (dy / dist) * force
      })
    })

    gEdges.forEach((edge) => {
      const src = nodeMap.get(edge.source), tgt = nodeMap.get(edge.target)
      if (!src || !tgt) return
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      const midX = (src.x + tgt.x) / 2, midY = (src.y + tgt.y) / 2 - 15
      ctx.quadraticCurveTo(midX, midY, tgt.x, tgt.y)
      ctx.strokeStyle = edge.trust_level > 0.7 ? 'hsla(142, 60%, 50%, 0.4)' : edge.trust_level > 0.3 ? 'hsla(35, 100%, 50%, 0.4)' : 'hsla(0, 72%, 51%, 0.4)'
      ctx.lineWidth = edge.trust_level * 2.5
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])

      const labelX = (src.x + tgt.x) / 2 + 8, labelY = (src.y + tgt.y) / 2 - 20
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(edge.relationship, labelX, labelY)
    })

    gNodes.forEach((n) => {
      const isHovered = hoveredNode === n.id
      const radius = 12

      ctx.beginPath()
      ctx.arc(n.x, n.y, isHovered ? radius + 4 : radius, 0, Math.PI * 2)
      ctx.fillStyle = n.risk_score > 80 ? 'hsla(0, 72%, 51%, 0.8)' : n.risk_score > 50 ? 'hsla(35, 100%, 50%, 0.8)' : 'hsla(142, 60%, 42%, 0.8)'
      ctx.fill()

      if (isHovered) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(n.name, n.x, n.y + radius + 14)
    })

    animRef.current = requestAnimationFrame(draw)
  }, [gNodes, gEdges, nodeMap, hoveredNode])

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const found = gNodes.find((n) => Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) < 16)
    setHoveredNode(found?.id || null)
  }

  const hoveredData = hoveredNode ? nodeMap.get(hoveredNode) : null
  const hoveredEdges = hoveredNode ? gEdges.filter((e) => e.source === hoveredNode || e.target === hoveredNode) : []

  return (
    <div className="space-y-5">
      <PageHeader title="Trust Graph" description="Visualize trust relationships and delegated permissions between agents" />

      <div className="flex items-center gap-2 mb-2">
        <Button size="sm" onClick={() => setShowCreatePanel((p) => !p)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Create Trust Edge</Button>
        {showCreatePanel && (
          <Button size="sm" variant="ghost" onClick={() => setShowCreatePanel(false)} className="gap-1"><X className="h-3.5 w-3.5" /> Cancel</Button>
        )}
      </div>

      {showCreatePanel && (
        <div className="rounded-md border bg-card p-4 flex items-end gap-3">
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)} options={[
            { value: '', label: 'Parent agent...' }, ...(agents || []).map((a) => ({ value: a.id, label: a.name })),
          ]} className="w-44" />
          <Select value={childId} onChange={(e) => setChildId(e.target.value)} options={[
            { value: '', label: 'Child agent...' }, ...(agents || []).map((a) => ({ value: a.id, label: a.name })),
          ]} className="w-44" />
          <Select value={relationship} onChange={(e) => setRelationship(e.target.value)} options={[
            { value: 'delegates', label: 'Delegates' }, { value: 'trusts', label: 'Trusts' }, { value: 'inherits', label: 'Inherits' },
          ]} className="w-32" />
          <Select value={String(trustLevel)} onChange={(e) => setTrustLevel(Number(e.target.value))} options={[
            { value: '1', label: 'Full Trust' }, { value: '0.7', label: 'High Trust' }, { value: '0.4', label: 'Medium Trust' }, { value: '0.1', label: 'Low Trust' },
          ]} className="w-32" />
          <Button size="sm" onClick={() => createEdge.mutate()} disabled={!parentId || !childId || createEdge.isPending}><Link2 className="h-3.5 w-3.5" /> Create</Button>
        </div>
      )}

      {isLoading ? <GraphSkeleton /> : (
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <div className="rounded-md border bg-card overflow-hidden">
              <canvas ref={canvasRef} width={800} height={500} className="w-full h-[500px] cursor-crosshair"
                onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredNode(null)} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-md border bg-card overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <h3 className="text-sm font-medium flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /> Details</h3>
              </div>
              <div className="p-3">
                {hoveredData ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Agent</span><span className="font-medium">{hoveredData.name}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Role</span><Badge variant="outline" className="text-[9px]">{hoveredData.role}</Badge></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><Badge variant={hoveredData.status === 'ACTIVE' ? 'success' : 'warning'} className="text-[9px]">{hoveredData.status}</Badge></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Risk</span><span className={cn('font-mono', hoveredData.risk_score > 80 ? 'text-danger' : hoveredData.risk_score > 50 ? 'text-warning' : 'text-success')}>{hoveredData.risk_score.toFixed(0)}</span></div>
                    {hoveredEdges.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-muted-foreground mb-1">Relationships</p>
                        {hoveredEdges.map((e, i) => {
                          const isSource = e.source === hoveredNode
                          const other = nodeMap.get(isSource ? e.target : e.source)
                          return (
                            <div key={i} className="flex items-center gap-1.5 py-1">
                              <Link2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px]">{isSource ? '→' : '←'} {other?.name || 'unknown'} ({e.relationship})</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Hover over a node</p>
                )}
              </div>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <h3 className="text-sm font-medium flex items-center gap-2"><Link2 className="h-4 w-4 text-muted-foreground" /> Active Edges</h3>
              </div>
              <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
                {gEdges.map((e, i) => {
                  const src = nodeMap.get(e.source)
                  const tgt = nodeMap.get(e.target)
                  return (
                    <div key={i} className="px-3 py-2 flex items-center justify-between hover:bg-muted/20 transition-colors">
                      <div className="text-xs min-w-0">
                        <span className="font-medium">{src?.name || e.source}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span className="font-medium">{tgt?.name || e.target}</span>
                        <Badge variant="outline" className="text-[8px] ml-1">{e.relationship}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteEdge.mutate(`${e.source}-${e.target}`)} className="h-6 w-6 p-0 text-muted-foreground hover:text-danger">
                        <Link2Off className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
                {gEdges.length === 0 && <div className="px-3 py-6 text-center text-xs text-muted-foreground">No trust edges</div>}
              </div>
            </div>

            <div className="rounded border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>{gNodes.length} agents, {gEdges.length} trust edges</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
