const BASE_URL = '/api'

let accessToken: string | null = localStorage.getItem('token')

export function setToken(token: string | null) {
  accessToken = token
  if (token) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }
}

export function getToken(): string | null {
  return accessToken
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    setToken(null)
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; user_id: string; role: string }>(
      '/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  getMe: () => request<{ id: string; email: string; name: string; role: string }>('/me'),

  getAgents: () => request<import('../types').Agent[]>('/agents'),

  getAgent: (id: string) => request<import('../types').AgentDetail>(`/agents/${id}`),

  registerAgent: (data: { name: string; role: string; capabilities: string[] }) =>
    request<import('../types').AgentDetail>('/agents/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAgent: (id: string) =>
    request<{ message: string }>(`/agents/${id}`, { method: 'DELETE' }),

  blockAgent: (id: string) =>
    request<import('../types').AgentDetail>(`/agents/${id}/block`, { method: 'POST' }),

  unquarantineAgent: (id: string) =>
    request<import('../types').AgentDetail>(`/agents/${id}/unquarantine`, { method: 'POST' }),

  getAgentBehavior: (id: string) =>
    request<import('../types').BehaviorProfile>(`/agents/${id}/behavior`),

  getAgentAudit: (id: string) =>
    request<import('../types').AuditLog[]>(`/agents/${id}/audit`),

  getPolicies: () => request<import('../types').Policy[]>('/policies'),

  createPolicy: (data: Partial<import('../types').Policy>) =>
    request<import('../types').Policy>('/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePolicy: (id: string, data: Partial<import('../types').Policy>) =>
    request<import('../types').Policy>(`/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePolicy: (id: string) =>
    request<{ message: string }>(`/policies/${id}`, { method: 'DELETE' }),

  executeTool: (agentId: string, toolName: string, toolArgs: Record<string, unknown> = {}) =>
    request<import('../types').ToolCall>('/execute-tool', {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId, tool_name: toolName, tool_args: toolArgs }),
    }),

  getAuditLogs: (params?: { action?: string; agent_id?: string; search?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.action) searchParams.set('action', params.action)
    if (params?.agent_id) searchParams.set('agent_id', params.agent_id)
    if (params?.search) searchParams.set('search', params.search)
    const qs = searchParams.toString()
    return request<import('../types').AuditLog[]>(`/audit${qs ? `?${qs}` : ''}`)
  },

  getRiskEvents: () => request<import('../types').RiskEvent[]>('/risk-events'),

  clearRiskEvents: () =>
    request<{ message: string }>('/risk-events/clear', { method: 'DELETE' }),

  getAuditEvent: (id: string) =>
    request<import('../types').AuditLog>(`/audit/${id}`),

  getDashboard: () => request<import('../types').DashboardData>('/dashboard'),

  getSettings: () => request<import('../types').Settings>('/settings'),

  updateSettings: (data: Partial<import('../types').Settings>) =>
    request<import('../types').Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getHealth: () => request<import('../types').HealthData>('/health'),

  getAnomalyDashboard: () => request<import('../types').AnomalyDashboard>('/anomaly/dashboard'),

  compareAgents: (ids: string[]) =>
    request<import('../types').CompareAgent[]>(`/compare/agents?ids=${ids.join(',')}`),

  getScenarioDefinitions: () =>
    request<{ key: string; name: string; description: string; type: string; severity: string; steps: number }[]>('/scenarios/definitions'),

  startScenario: (scenarioKey: string) =>
    request<{ status: string; scenario_key?: string; message?: string }>('/scenarios/start', {
      method: 'POST', body: JSON.stringify({ scenario_key: scenarioKey }),
    }),

  pauseScenario: () =>
    request<{ status: string; message?: string }>('/scenarios/pause', { method: 'POST' }),

  stopScenario: () =>
    request<{ status: string; message?: string }>('/scenarios/stop', { method: 'POST' }),

  resetScenario: () =>
    request<{ status: string; message?: string }>('/scenarios/reset', { method: 'POST' }),

  getScenarioState: () =>
    request<{ status: string; scenario_key: string; current_step: number; total_steps: number; elapsed_seconds: number; current_label: string }>('/scenarios/state'),
}
