import { useAuthStore } from '@/store/auth'
import type { Role } from '@/types'

const CAN_ACCESS: Record<string, Role[]> = {
  '/settings': ['admin'],
  '/demo-director': ['admin', 'demo'],
  '/scenarios': ['admin', 'demo', 'analyst', 'operator', 'engineer'],
  '/policies': ['admin', 'operator', 'engineer'],
}

export function usePermissions() {
  const user = useAuthStore((s) => s.user)
  const hasRole = useAuthStore((s) => s.hasRole)

  const canAccessRoute = (path: string): boolean => {
    if (!user) return false
    const allowed = CAN_ACCESS[path]
    if (!allowed) return true
    return allowed.includes(user.role) || user.role === 'admin'
  }

  const can = {
    viewDashboard: true,
    viewAgents: true,
    viewIncidents: ['viewer', 'analyst', 'operator', 'engineer', 'admin', 'demo'].includes(user?.role || ''),
    viewAudit: ['viewer', 'analyst', 'operator', 'engineer', 'admin', 'demo'].includes(user?.role || ''),
    viewRiskTimelines: ['viewer', 'analyst', 'operator', 'engineer', 'admin'].includes(user?.role || ''),
    viewForensicTimelines: ['analyst', 'operator', 'engineer', 'admin'].includes(user?.role || ''),
    viewSystemHealth: true,
    modifyPolicies: hasRole(['operator', 'engineer', 'admin']),
    quarantineAgents: hasRole(['analyst', 'operator', 'engineer', 'admin']),
    blockAgents: hasRole(['operator', 'engineer', 'admin']),
    deleteAgents: hasRole(['admin']),
    changeSettings: hasRole(['admin']),
    runScenarios: hasRole(['demo', 'analyst', 'operator', 'engineer', 'admin']),
    runDemoDirector: hasRole(['demo', 'admin']),
    manageUsers: hasRole(['admin']),
    acknowledgeIncidents: hasRole(['analyst', 'operator', 'engineer', 'admin']),
    triggerContainment: hasRole(['analyst', 'operator', 'engineer', 'admin']),
    exportReports: hasRole(['analyst', 'operator', 'engineer', 'admin']),
    createInvestigationNotes: hasRole(['analyst', 'operator', 'engineer', 'admin']),
    runForensicAnalysis: hasRole(['analyst', 'operator', 'engineer', 'admin']),
    createPolicies: hasRole(['operator', 'engineer', 'admin']),
    editPolicies: hasRole(['operator', 'engineer', 'admin']),
    deletePolicies: hasRole(['operator', 'engineer', 'admin']),
    configureHoneyTools: hasRole(['operator', 'engineer', 'admin']),
    configureRiskThresholds: hasRole(['operator', 'engineer', 'admin']),
    configureIntegrations: hasRole(['operator', 'engineer', 'admin']),
    configureTrustRelationships: hasRole(['operator', 'engineer', 'admin']),
    changeSystemOwnership: hasRole(['admin']),
  }

  return { can, canAccessRoute, role: user?.role ?? null }
}
