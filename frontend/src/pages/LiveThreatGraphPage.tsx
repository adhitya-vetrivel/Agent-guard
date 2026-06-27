import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, Bot, ArrowDown } from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { DecisionExplanation } from '@/components/DecisionExplanation'
import { cn } from '@/lib/utils'
import type { Agent, RiskEvent } from '@/types'

interface GNode {
  id: string; x: number; y: number; vx: number; vy: number
  label: string; type: 'agent' | 'toolcall' | 'honeytool' | 'containment' | 'quarantine'
  riskScore: number; layer: number; pulse: boolean
}
interface GEdge { source: string; target: string; color: string; width: number; style?: 'solid' | 'dashed' }

const LAYER_Y = [80, 180, 280, 380, 480]
const LAYER_LABELS = ['Agent', 'Tool Call', 'HoneyTool', 'Containment', 'Quarantine']

export function LiveThreatGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(true)

  const { data: agents } = useQuery<Agent[]>({ queryKey: ['agents'], queryFn: () => api.getAgents(), refetchInterval: 3000 })
  const { data: riskEvents } = useQuery<RiskEvent[]>({ queryKey: ['risk-events-threat'], queryFn: () => api.getRiskEvents(), refetchInterval: 3000 })
  const { data: triggerData } = useQuery({ queryKey: ['honeytool-triggers-graph'], queryFn: () => api.getHoneyToolTriggers(), refetchInterval: 3000 })

  const { nodes, edges } = useMemo(() => {
    const gNodes: GNode[] = []
    const gEdges: GEdge[] = []
    const layerCounts: number[] = [0, 0, 0, 0, 0]

    if (agents) {
      agents.forEach((a, i) => {
        const lx = 60 + (i % 4) * 100
        gNodes.push({
          id: a.id, x: lx, y: LAYER_Y[0] + (Math.random() - 0.5) * 20,
          vx: 0, vy: 0, label: a.name, type: 'agent',
          riskScore: a.risk_score, layer: 0, pulse: a.risk_score > 80,
        })
        layerCounts[0]++
      })
    }

    if (riskEvents) {
      riskEvents.slice(-15).forEach((e, i) => {
        const layer = e.is_honeytool ? 2 : 1
        const eid = `event-${e.id}`
        const lx = 60 + (layerCounts[layer] % 4) * 100
        gNodes.push({
          id: eid, x: lx, y: LAYER_Y[layer] + (Math.random() - 0.5) * 15,
          vx: 0, vy: 0,
          label: e.tool_name || e.event_type || 'tool_call',
          type: e.is_honeytool ? 'honeytool' : 'toolcall',
          riskScore: e.risk_score, layer, pulse: e.risk_score > 80,
        })
        layerCounts[layer]++

        if (e.agent_id && gNodes.some((n) => n.id === e.agent_id)) {
          const edgeColor = e.is_honeytool ? 'hsl(0, 72%, 51%)' :
            e.risk_score > 80 ? 'hsl(0, 72%, 51%)' :
            e.risk_score > 50 ? 'hsl(35, 100%, 50%)' : 'hsl(142, 100%, 50%)'
          gEdges.push({ source: e.agent_id, target: eid, color: edgeColor, width: e.risk_score > 80 ? 2 : 1.5 })

          if (e.is_honeytool) {
            const cid = `contain-${e.id}`
            const cx = 60 + (layerCounts[3] % 3) * 120
            gNodes.push({
              id: cid, x: cx, y: LAYER_Y[3] + (Math.random() - 0.5) * 10,
              vx: 0, vy: 0, label: 'Containment Engine', type: 'containment',
              riskScore: e.risk_score, layer: 3, pulse: true,
            })
            layerCounts[3]++
            gEdges.push({ source: eid, target: cid, color: 'hsl(0, 72%, 51%)', width: 2, style: 'dashed' })

            const qid = `quarantine-${e.id}`
            const qx = 60 + (layerCounts[4] % 3) * 120
            gNodes.push({
              id: qid, x: qx, y: LAYER_Y[4],
              vx: 0, vy: 0, label: 'QUARANTINED', type: 'quarantine',
              riskScore: 100, layer: 4, pulse: false,
            })
            layerCounts[4]++
            gEdges.push({ source: cid, target: qid, color: 'hsl(0, 72%, 51%)', width: 2.5 })
          }
        }
      })
    }

    return { nodes: gNodes, edges: gEdges }
  }, [agents, riskEvents, triggerData])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas?.getContext?.('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
    ctx.fillRect(0, 0, W, H)

    LAYER_LABELS.forEach((label, i) => {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(label.toUpperCase(), 16, LAYER_Y[i] - 14)
    })

    nodes.forEach((n) => {
      n.x += n.vx || 0; n.y += n.vy || 0
      n.x = Math.max(30, Math.min(W - 30, n.x))
      n.y = Math.max(LAYER_Y[n.layer] - 20, Math.min(LAYER_Y[n.layer] + 20, n.y))
      n.vx = (n.vx || 0) * 0.9; n.vy = (n.vy || 0) * 0.9
    })

    nodes.forEach((a) => {
      nodes.forEach((b) => {
        if (a.id >= b.id || a.layer !== b.layer) return
        const dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
        if (dist > 150) return
        const force = (150 - dist) / dist * 0.02
        a.vx! -= (dx / dist) * force; a.vy! -= (dy / dist) * force
        b.vx! += (dx / dist) * force; b.vy! += (dy / dist) * force
      })
    })

    nodes.forEach((n) => {
      const targetY = LAYER_Y[n.layer]
      n.vy! += (targetY - n.y) * 0.01
    })

    edges.forEach((edge) => {
      const src = nodes.find((n) => n.id === edge.source)
      const tgt = nodes.find((n) => n.id === edge.target)
      if (!src || !tgt) return

      ctx.beginPath()
      ctx.moveTo(src.x, src.y)

      const midX = (src.x + tgt.x) / 2
      const midY = (src.y + tgt.y) / 2 + 20
      ctx.quadraticCurveTo(midX, midY, tgt.x, tgt.y)

      ctx.strokeStyle = edge.color
      ctx.lineWidth = edge.width
      if (edge.style === 'dashed') {
        ctx.setLineDash([4, 4])
      } else {
        ctx.setLineDash([])
      }
      ctx.stroke()
      ctx.setLineDash([])

    })

    nodes.forEach((n) => {
      const isHovered = hoveredNode === n.id
      const radius = n.type === 'agent' ? 10 : n.type === 'quarantine' ? 12 : n.type === 'containment' ? 9 : n.type === 'honeytool' ? 9 : 7

      ctx.beginPath()
      ctx.arc(n.x, n.y, isHovered ? radius + 3 : radius, 0, Math.PI * 2)

      if (n.type === 'agent') {
        ctx.fillStyle = n.riskScore > 80 ? 'hsla(0, 72%, 51%, 0.85)' : n.riskScore > 50 ? 'hsla(35, 100%, 50%, 0.85)' : 'hsla(142, 100%, 50%, 0.85)'
      } else if (n.type === 'quarantine') {
        ctx.fillStyle = 'hsla(0, 72%, 51%, 0.85)'
      } else if (n.type === 'containment') {
        ctx.fillStyle = 'hsla(35, 100%, 50%, 0.8)'
      } else if (n.type === 'honeytool') {
        ctx.fillStyle = 'hsla(0, 72%, 51%, 0.85)'
      } else {
        ctx.fillStyle = n.riskScore > 50 ? 'hsla(35, 100%, 50%, 0.65)' : 'hsla(142, 50%, 42%, 0.65)'
      }
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.stroke()

      if (showLabels || isHovered) {
        ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'
        ctx.font = isHovered ? 'bold 10px monospace' : '9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(n.label, n.x, n.y + radius + 12)

        if (n.type !== 'agent' && n.type !== 'quarantine') {
          const scoreLabel = n.riskScore?.toFixed(0) || ''
          ctx.fillStyle = n.riskScore > 80 ? 'hsla(0, 72%, 51%, 0.8)' : n.riskScore > 50 ? 'hsla(35, 100%, 50%, 0.8)' : 'hsla(142, 100%, 50%, 0.8)'
          ctx.font = '8px monospace'
          ctx.fillText(scoreLabel, n.x, n.y + radius + 22)
        }
      }
    })

    if (hoveredNode) {
      const n = nodes.find((nd) => nd.id === hoveredNode)
      if (n) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)'
        const tooltip = `${n.label} | Risk: ${n.riskScore?.toFixed(0) || 'N/A'} | Layer: ${LAYER_LABELS[n.layer]}`
        ctx.font = '11px monospace'
        const tw = ctx.measureText(tooltip).width
        const tx = Math.max(10, Math.min(W - tw - 20, n.x - tw / 2))
        const ty = n.y - 30
        ctx.fillRect(tx - 6, ty - 14, tw + 12, 20)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fillText(tooltip, tx, ty + 2)
      }
    }

    animRef.current = requestAnimationFrame(draw)
  }, [nodes, edges, hoveredNode, showLabels])

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

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const found = nodes.find((n) => {
      const r = n.type === 'agent' ? 10 : n.type === 'quarantine' ? 12 : n.type === 'containment' ? 9 : n.type === 'honeytool' ? 9 : 7
      return Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) < r + 5
    })
    setHoveredNode(found?.id || null)
    if (found) canvas.style.cursor = 'pointer'
    else canvas.style.cursor = 'default'
  }, [nodes])

  const agentCount = agents?.length || 0
  const eventCount = riskEvents?.length || 0
  const containmentCount = edges.filter(e => e.color.includes('0, 72%, 51%')).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Live Threat Graph</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Attack flow visualization &mdash; agent-to-quarantine progression</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowLabels(!showLabels)}
            className="px-2.5 py-1 text-xs rounded-md border border-border bg-transparent hover:bg-accent transition-colors text-muted-foreground">
            {showLabels ? 'Hide' : 'Show'} Labels
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="font-mono text-[10px] gap-1"><Bot className="h-3 w-3" /> Agents ({agentCount})</Badge>
        <Badge variant="success" className="font-mono text-[10px] gap-1"><span className="h-2 w-2 rounded-full bg-success inline-block" /> Normal Path</Badge>
        <Badge variant="warning" className="font-mono text-[10px] gap-1"><span className="h-2 w-2 rounded-full bg-warning inline-block" /> Suspicious Path</Badge>
        <Badge variant="danger" className="font-mono text-[10px] gap-1"><ShieldAlert className="h-3 w-3" /> Containment ({containmentCount})</Badge>
      </div>

      <div
        className="rounded-lg border bg-card overflow-hidden"
        style={{ height: '560px' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredNode(null)}
        />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-semibold text-sm flex items-center gap-2"><ArrowDown className="h-4 w-4 text-primary" /> Attack Flow Story</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          {LAYER_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 rounded-lg bg-muted/20 p-2">
              <div className={cn(
                'h-3 w-3 rounded-full shrink-0',
                i === 0 ? 'bg-success' : i === 1 ? 'bg-success' : i === 2 ? 'bg-purple-500' : i === 3 ? 'bg-warning' : 'bg-danger'
              )} />
              <div>
                <p className="font-medium text-foreground">{label}</p>
                <p className="text-[9px] text-muted-foreground">
                  {i === 0 && 'AI agent makes tool calls'}
                  {i === 1 && 'Tools are evaluated for risk'}
                  {i === 2 && 'Suspicious tool triggers honeytrap'}
                  {i === 3 && 'Containment engine quarantines agent'}
                  {i === 4 && 'Agent blocked from further actions'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {hoveredNode && (() => {
        const node = nodes.find(n => n.id === hoveredNode)
        if (!node) return null
        return (
          <DecisionExplanation
            explanation={{
              decision: node.type === 'honeytool' ? 'HoneyTool Activated' : node.type === 'containment' ? 'Containment Initiated' : node.type === 'quarantine' ? 'Agent Quarantined' : 'Tool Evaluated',
              reason: node.type === 'honeytool'
                ? 'Agent attempted a decoy tool and exposed malicious intent.'
                : node.riskScore > 80
                ? 'Risk score exceeded threshold of 80.'
                : 'Tool call evaluated against active policies.',
              evidence: [`Node: ${node.label}`, `Risk score: ${node.riskScore.toFixed(0)}`, `Layer: ${LAYER_LABELS[node.layer]}`],
              rule_triggered: node.type === 'honeytool' ? 'honeytool_decoy_trigger' : 'policy_evaluation',
              risk_contribution: node.riskScore,
            }}
          />
        )
      })()}
    </div>
  )
}


