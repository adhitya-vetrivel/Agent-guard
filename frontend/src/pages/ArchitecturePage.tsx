import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType, Handle, Position
} from 'reactflow'
import 'reactflow/dist/style.css'
import { User, Shield, Fingerprint, ShieldCheck, Brain, Terminal, ScrollText } from 'lucide-react'

const iconMap: Record<string, React.ReactNode> = {
  user: <User className="h-4 w-4" />,
  gateway: <Shield className="h-4 w-4" />,
  identity: <Fingerprint className="h-4 w-4" />,
  policy: <ShieldCheck className="h-4 w-4" />,
  behavior: <Brain className="h-4 w-4" />,
  execution: <Terminal className="h-4 w-4" />,
  audit: <ScrollText className="h-4 w-4" />,
}

// Custom Node Component to display rich icons, descriptions, and handles
function CustomNode({ data }: { data: any }) {
  const Icon = iconMap[data.icon] || null
  return (
    <div className="relative rounded border border-border bg-card p-3 shadow-xs w-52 text-left font-mono text-xs">
      <div className="flex items-center gap-1.5 text-foreground font-bold">
        <span className="text-muted-foreground shrink-0">{Icon}</span>
        <span>{data.label}</span>
      </div>
      {data.desc && (
        <p className="text-[10px] text-muted-foreground font-normal mt-1 leading-normal whitespace-pre-line">
          {data.desc}
        </p>
      )}
      <Handle type="target" position={Position.Top} className="!bg-border !border-border !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-border !border-border !w-2 !h-2" />
    </div>
  )
}

const initialNodes: Node[] = [
  { id: 'user', type: 'custom', position: { x: 250, y: 0 }, data: { label: 'User / Agent Identity', icon: 'user', desc: 'Active AI agent or operator request' } },
  { id: 'gateway', type: 'custom', position: { x: 250, y: 110 }, data: { label: 'Runtime Gateway', icon: 'gateway', desc: 'Interception and route inspection' } },
  { id: 'identity', type: 'custom', position: { x: 50, y: 220 }, data: { label: 'Identity Engine', icon: 'identity', desc: 'JWT verification and auth checks' } },
  { id: 'policy', type: 'custom', position: { x: 450, y: 220 }, data: { label: 'Policy Engine', icon: 'policy', desc: 'Fine-grained RBAC permission DSL' } },
  { id: 'behavior', type: 'custom', position: { x: 250, y: 330 }, data: { label: 'Behavior Engine', icon: 'behavior', desc: 'Isolation forest anomaly profiling' } },
  { id: 'execution', type: 'custom', position: { x: 250, y: 440 }, data: { label: 'Execution Engine', icon: 'execution', desc: 'Sandboxed tools & decoy honeytraps' } },
  { id: 'audit', type: 'custom', position: { x: 250, y: 550 }, data: { label: 'Audit Compliance', icon: 'audit', desc: 'Verifiable history logs & alert queues' } },
]

const initialEdges: Edge[] = [
  { id: 'e1', source: 'user', target: 'gateway', animated: true, style: { stroke: 'var(--primary)', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' } },
  { id: 'e2', source: 'gateway', target: 'identity', animated: true, style: { stroke: 'var(--border)', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
  { id: 'e3', source: 'gateway', target: 'policy', animated: true, style: { stroke: 'var(--border)', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
  { id: 'e4', source: 'identity', target: 'behavior', style: { stroke: 'var(--border)', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
  { id: 'e5', source: 'policy', target: 'behavior', style: { stroke: 'var(--border)', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
  { id: 'e6', source: 'behavior', target: 'execution', animated: true, style: { stroke: 'var(--primary)', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' } },
  { id: 'e7', source: 'execution', target: 'audit', style: { stroke: 'var(--border)', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
  { id: 'e8', source: 'audit', target: 'user', style: { stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4,4' }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
]

export function ArchitecturePage() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)
  
  const nodeTypes = useMemo(() => ({
    custom: CustomNode
  }), [])

  return (
    <div className="space-y-4 text-sm">
      {/* Title */}
      <div className="border-b border-border pb-2.5">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground font-mono">Architecture</h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">AgentGuard runtime security pipeline mapping</p>
      </div>

      <div className="h-[520px] rounded border bg-card overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--border)" gap={20} />
          <Controls style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--foreground)' }} />
          <MiniMap style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px' }} nodeColor={() => 'var(--primary)'} maskColor="rgba(0,0,0,0.6)" />
        </ReactFlow>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { name: 'Runtime Gateway', desc: 'Intercepts every tool request and routes through the security pipeline' },
          { name: 'Identity Engine', desc: 'Authenticates agents using JWT, validates identity and session' },
          { name: 'Policy Engine', desc: 'Enforces RBAC, checks allowed/denied tools, permission expiry' },
          { name: 'Behavior Engine', desc: 'Tracks tool frequency, sequences, anomalies using Isolation Forest' },
          { name: 'Risk Engine', desc: 'Calculates real-time risk scores (0-100), triggers automatic containment' },
          { name: 'HoneyTools', desc: 'Deceptive decoy tools that immediately trigger containment when called' },
          { name: 'Audit Engine', desc: 'Complete audit trail of all decisions, events, and changes' },
          { name: 'WebSocket', desc: 'Real-time dashboard updates via WebSocket broadcasting' },
        ].map((item) => (
          <div key={item.name} className="rounded border bg-card p-3 font-mono">
            <h3 className="font-semibold text-xs text-foreground">{item.name}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground leading-normal">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
