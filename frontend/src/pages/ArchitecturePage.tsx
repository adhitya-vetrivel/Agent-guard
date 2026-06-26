import { useCallback } from 'react'
import ReactFlow, { Node, Edge, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType } from 'reactflow'
import 'reactflow/dist/style.css'
import { User, Shield, Fingerprint, ShieldCheck, Brain, Terminal, ScrollText } from 'lucide-react'

const iconMap: Record<string, React.ReactNode> = {
  user: <User className="h-5 w-5" />, gateway: <Shield className="h-5 w-5" />, identity: <Fingerprint className="h-5 w-5" />,
  policy: <ShieldCheck className="h-5 w-5" />, behavior: <Brain className="h-5 w-5" />, execution: <Terminal className="h-5 w-5" />, audit: <ScrollText className="h-5 w-5" />,
}

const initialNodes: Node[] = [
  { id: 'user', type: 'default', position: { x: 250, y: 0 }, data: { label: 'User / Agent', icon: 'user', desc: 'AI Agent or End User' }, style: { background: 'linear-gradient(135deg, hsl(142, 100%, 50%), hsl(142, 80%, 40%))', color: '#000', border: 'none', borderRadius: '12px', padding: '16px 24px', fontWeight: 600, fontSize: 14, width: 180, boxShadow: '0 4px 20px rgba(0, 255, 136, 0.2)' } },
  { id: 'gateway', type: 'default', position: { x: 250, y: 120 }, data: { label: 'Runtime Gateway', icon: 'gateway', desc: 'Request interception & routing' }, style: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 24px', fontWeight: 600, fontSize: 14, width: 180 } },
  { id: 'identity', type: 'default', position: { x: 50, y: 260 }, data: { label: 'Identity Engine', icon: 'identity', desc: 'JWT verification & agent auth' }, style: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 24px', fontWeight: 600, fontSize: 14, width: 180 } },
  { id: 'policy', type: 'default', position: { x: 450, y: 260 }, data: { label: 'Policy Engine', icon: 'policy', desc: 'Permission & access control' }, style: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 24px', fontWeight: 600, fontSize: 14, width: 180 } },
  { id: 'behavior', type: 'default', position: { x: 250, y: 400 }, data: { label: 'Behavior Engine', icon: 'behavior', desc: 'Anomaly detection & profiling' }, style: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 24px', fontWeight: 600, fontSize: 14, width: 180 } },
  { id: 'execution', type: 'default', position: { x: 250, y: 540 }, data: { label: 'Execution Engine', icon: 'execution', desc: 'Tool execution & honeytraps' }, style: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 24px', fontWeight: 600, fontSize: 14, width: 180 } },
  { id: 'audit', type: 'default', position: { x: 250, y: 680 }, data: { label: 'Audit Engine', icon: 'audit', desc: 'Logging & compliance' }, style: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 24px', fontWeight: 600, fontSize: 14, width: 180 } },
]

const initialEdges: Edge[] = [
  { id: 'e1', source: 'user', target: 'gateway', animated: true, style: { stroke: 'hsl(142, 100%, 50%)', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(142, 100%, 50%)' } },
  { id: 'e2', source: 'gateway', target: 'identity', animated: true, style: { stroke: 'var(--border)', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
  { id: 'e3', source: 'gateway', target: 'policy', animated: true, style: { stroke: 'var(--border)', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
  { id: 'e4', source: 'identity', target: 'behavior', style: { stroke: 'var(--border)', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
  { id: 'e5', source: 'policy', target: 'behavior', style: { stroke: 'var(--border)', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
  { id: 'e6', source: 'behavior', target: 'execution', animated: true, style: { stroke: 'hsl(142, 100%, 50%)', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(142, 100%, 50%)' } },
  { id: 'e7', source: 'execution', target: 'audit', style: { stroke: 'var(--border)', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
  { id: 'e8', source: 'audit', target: 'user', style: { stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '5,5' }, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' } },
]

export function ArchitecturePage() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)
  const nodeTypes = useCallback(() => ({}), [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Architecture</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">AgentGuard runtime security pipeline</p>
      </div>

      <div className="h-[500px] sm:h-[600px] rounded-lg border bg-card overflow-hidden">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView attributionPosition="bottom-left" proOptions={{ hideAttribution: true }}>
          <Background color="var(--border)" gap={20} />
          <Controls style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)' }} />
          <MiniMap style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} nodeColor={() => 'hsl(142, 100%, 50%)'} maskColor="rgba(0,0,0,0.7)" />
        </ReactFlow>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div key={item.name} className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold text-sm">{item.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
