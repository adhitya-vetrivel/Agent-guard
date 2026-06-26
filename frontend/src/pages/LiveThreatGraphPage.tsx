import { useRef, useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, ShieldAlert, RefreshCw } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import type { Agent, RiskEvent } from '@/types'

interface GNode {
  id: string; x: number; y: number; vx: number; vy: number; label: string; type: 'agent' | 'event' | 'honeytool'; riskScore: number
}
interface GEdge { source: string; target: string; color: string; width: number }

const TYPES = ['all', 'real-time', 'historical'] as const
const LAYOUTS = ['force', 'radial', 'grid'] as const

export function LiveThreatGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedLayout, setSelectedLayout] = useState<string>('force')
  const [nodes, setNodes] = useState<GNode[]>([])
  const [edges, setEdges] = useState<GEdge[]>([])

  const { data: agents } = useQuery<Agent[]>({ queryKey: ['agents'], queryFn: () => api.getAgents(), refetchInterval: 3000 })
  const { data: riskEvents } = useQuery<RiskEvent[]>({ queryKey: ['risk-events-threat'], queryFn: () => api.getRiskEvents(), refetchInterval: 3000 })

  useEffect(() => {
    if (!agents) return
    const gNodes: GNode[] = agents.map((a, i) => ({
      id: a.id, x: 100 + Math.random() * 600, y: 100 + Math.random() * 400,
      vx: 0, vy: 0, label: a.name, type: 'agent', riskScore: a.risk_score,
    }))
    const gEdges: GEdge[] = []
    const eventNodes: GNode[] = []
    const eventEdges: GEdge[] = []

    if (riskEvents) {
      riskEvents.slice(-10).forEach((e, i) => {
        const eid = `event-${e.id}`
        eventNodes.push({ id: eid, x: 300 + Math.random() * 400, y: 50 + Math.random() * 300, vx: 0, vy: 0, label: e.tool_name || e.event_type || 'event', type: e.is_honeytool ? 'honeytool' : 'event', riskScore: e.risk_score })
        if (e.agent_id && gNodes.some((n) => n.id === e.agent_id)) {
          eventEdges.push({ source: e.agent_id, target: eid, color: e.risk_score > 80 ? 'hsl(0, 72%, 51%)' : e.risk_score > 50 ? 'hsl(35, 100%, 50%)' : 'hsl(142, 100%, 50%)', width: 1.5 })
        }
      })
    }

    setNodes([...gNodes, ...eventNodes])
    setEdges([...gEdges, ...eventEdges])
  }, [agents, riskEvents])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(0, 0, W, H)

    nodes.forEach((n) => {
      n.x += n.vx || 0; n.y += n.vy || 0
      n.x = Math.max(20, Math.min(W - 20, n.x))
      n.y = Math.max(20, Math.min(H - 20, n.y))
      n.vx *= 0.95; n.vy *= 0.95
    })

    if (selectedLayout === 'force') {
      nodes.forEach((a) => { nodes.forEach((b) => {
        if (a.id >= b.id) return
        const dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
        const force = 1 / dist
        a.vx! -= (dx / dist) * force; a.vy! -= (dy / dist) * force
        b.vx! += (dx / dist) * force; b.vy! += (dy / dist) * force
      })})
    } else if (selectedLayout === 'radial') {
      const cx = W / 2, cy = H / 2
      nodes.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / nodes.length
        const r = 150
        n.x = cx + r * Math.cos(angle + Date.now() * 0.0001)
        n.y = cy + r * Math.sin(angle + Date.now() * 0.0001)
      })
    } else if (selectedLayout === 'grid') {
      const cols = Math.ceil(Math.sqrt(nodes.length))
      nodes.forEach((n, i) => {
        n.x = 60 + (i % cols) * 120
        n.y = 60 + Math.floor(i / cols) * 120
      })
    }

    edges.forEach((edge) => {
      const src = nodes.find((n) => n.id === edge.source)
      const tgt = nodes.find((n) => n.id === edge.target)
      if (!src || !tgt) return
      ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(tgt.x, tgt.y)
      ctx.strokeStyle = edge.color; ctx.lineWidth = edge.width; ctx.stroke()
    })

    nodes.forEach((n) => {
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.type === 'agent' ? 8 : n.type === 'honeytool' ? 10 : 6, 0, Math.PI * 2)
      if (n.type === 'agent') {
        ctx.fillStyle = n.riskScore > 80 ? 'hsla(0, 72%, 51%, 0.8)' : n.riskScore > 50 ? 'hsla(35, 100%, 50%, 0.8)' : 'hsla(142, 100%, 50%, 0.8)'
      } else if (n.type === 'honeytool') {
        ctx.fillStyle = 'hsla(0, 72%, 51%, 0.9)'
      } else {
        ctx.fillStyle = 'hsla(217, 90%, 60%, 0.7)'
      }
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke()

      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(n.label, n.x, n.y + 16)
    })

    animRef.current = requestAnimationFrame(draw)
  }, [nodes, edges, selectedLayout])

  useEffect(() => { animRef.current = requestAnimationFrame(draw); return () => cancelAnimationFrame(animRef.current) }, [draw])

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const parent = canvas.parentElement
      if (parent) { canvas.width = parent.clientWidth; canvas.height = parent.clientHeight }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Live Threat Graph</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Real-time agent communication topology</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
            options={TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ') }))}
            className="w-32" />
          <Select value={selectedLayout} onChange={(e) => setSelectedLayout(e.target.value)}
            options={LAYOUTS.map((l) => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) }))}
            className="w-28" />
          <Button variant="outline" size="icon" onClick={() => {}} className="h-8 w-8"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="font-mono text-[10px] gap-1"><span className="h-2 w-2 rounded-full bg-success inline-block" /> Agents ({agents?.length || 0})</Badge>
        <Badge className="font-mono text-[10px] gap-1"><span className="h-2 w-2 rounded-full bg-primary inline-block" /> Events ({riskEvents?.length || 0})</Badge>
        <Badge variant="danger" className="font-mono text-[10px] gap-1"><ShieldAlert className="h-3 w-3" /> Honeytools</Badge>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden" style={{ height: '500px' }}>
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-2 font-semibold text-sm">Legend</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-success" /> Safe Agent (0-50)</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-warning" /> Suspicious Agent (51-80)</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-danger" /> Critical Agent (81-100)</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary" /> Risk Event</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-danger" /> HoneyTool Triggered</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm border border-warning bg-warning/20" /> Warning Edge</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm border border-success bg-success/20" /> Normal Edge</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm border border-danger bg-danger/20" /> Critical Edge</div>
        </div>
      </div>
    </div>
  )
}
