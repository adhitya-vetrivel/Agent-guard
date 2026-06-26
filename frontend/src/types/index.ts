export interface User {
  id: string
  email: string
  name: string
  role: string
}

export interface Agent {
  id: string
  name: string
  role: string
  capabilities: string[]
  risk_score: number
  status: 'ACTIVE' | 'BLOCKED' | 'QUARANTINED'
  last_seen: string | null
  session_id: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface AgentDetail extends Agent {
  jwt_identity: string | null
}

export interface Policy {
  id: string
  name: string
  description: string | null
  allowed_tools: string[]
  denied_tools: string[]
  agent_id: string | null
  role: string | null
  task_scope: string | null
  permission_expiry: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ToolCall {
  id: string
  agent_id: string
  agent_name: string
  tool_name: string
  tool_args: string
  decision: string
  risk_score: number
  reason: string | null
  ip_address: string | null
  session_id: string | null
  execution_time_ms: number | null
  is_honeytool: boolean
  created_at: string
  result?: unknown
}

export interface AuditLog {
  id: string
  timestamp: string
  action: string
  agent_id: string | null
  agent_name: string | null
  tool_name: string | null
  decision: string | null
  risk_score: number | null
  reason: string | null
  ip_address: string | null
  session_id: string | null
  details: string | null
  user_id: string | null
}

export interface RiskEvent {
  id: string
  agent_id: string
  agent_name: string | null
  severity: 'SAFE' | 'WARNING' | 'HIGH' | 'CRITICAL'
  risk_score: number
  reason: string
  tool_name: string | null
  event_type?: string
  is_honeytool?: boolean
  triggered_containment: boolean
  details: string | null
  created_at: string
}

export interface DashboardStats {
  total_agents: number
  active_agents: number
  blocked_agents: number
  quarantined_agents: number
  total_tool_calls: number
  threats_detected: number
  risk_events_today: number
  average_risk_score: number
}

export interface DashboardData {
  stats: DashboardStats
  recent_events: RecentEvent[]
  risk_over_time: RiskOverTime[]
  tool_usage: ToolUsage[]
  agent_activity: AgentActivity[]
  recent_tool_calls: RecentToolCall[]
}

export interface RecentEvent {
  id: string
  action: string
  agent_name: string | null
  tool_name: string | null
  decision: string | null
  risk_score: number | null
  timestamp: string
}

export interface RiskOverTime {
  time: string
  avg_score: number
  max_score: number
  count: number
}

export interface ToolUsage {
  tool: string
  count: number
}

export interface AgentActivity {
  agent: string
  count: number
}

export interface RecentToolCall {
  id: string
  agent_name: string
  tool_name: string
  decision: string
  risk_score: number
  created_at: string
  is_honeytool: boolean
}

export interface BehaviorProfile {
  agent_id: string
  tool_frequency_1h: number
  tool_frequency_24h: number
  denied_requests_24h: number
  tool_diversity_24h: number
  failed_attempts_24h: number
  recent_tools: string[]
}

export interface WSMessage {
  type: string
  data: Record<string, unknown>
}

export interface PaletteOption {
  id: string
  name: string
  primary: string
}

export interface Settings {
  containment_threshold: number
  demo_mode: boolean
  rate_limit_per_minute: number
  app_name: string
  anomaly_contamination: number
  decoy_tool_penalty: number
  denied_call_penalty: number
  rapid_burst_penalty: number
  privilege_escalation_penalty: number
  active_palette: string
  available_palettes: PaletteOption[]
}

export interface AnomalyProfile {
  agent_id: string
  agent_name: string
  risk_score: number
  status: string
  is_anomaly: boolean
  anomaly_score: number
  tool_frequency_1h: number
  tool_frequency_24h: number
  denied_requests_24h: number
  tool_diversity_24h: number
  failed_attempts_24h: number
}

export interface AnomalyDashboard {
  profiles: AnomalyProfile[]
  events: {
    id: string
    agent_name: string | null
    severity: string
    risk_score: number
    reason: string
    tool_name: string | null
    created_at: string
  }[]
  total_calls: number
  anomaly_count: number
  model_initialized: boolean
  samples_collected: number
}

export interface CompareAgent {
  id: string
  name: string
  role: string
  status: string
  risk_score: number
  capabilities: string[]
  last_seen: string | null
  behavior: {
    tool_frequency_1h: number
    tool_frequency_24h: number
    denied_requests_24h: number
    tool_diversity_24h: number
    failed_attempts_24h: number
  }
  recent_calls: {
    tool_name: string
    decision: string
    risk_score: number
    created_at: string
  }[]
  risk_events: {
    severity: string
    risk_score: number
    reason: string
    created_at: string
  }[]
}

export interface ScenarioDefinition {
  key: string
  name: string
  description: string
  type: string
  severity: string
  steps: number
}

export interface ScenarioState {
  status: string
  scenario_key: string
  current_step: number
  total_steps: number
  elapsed_seconds: number
  current_label: string
}

export interface HealthData {
  status: string
  app: string
  version: string
  demo_mode: boolean
  stats: {
    agents: number
    tool_calls: number
    risk_events: number
  }
}
