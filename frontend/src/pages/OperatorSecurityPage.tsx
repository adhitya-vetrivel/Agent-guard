import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Shield, AlertTriangle, User, Activity, RefreshCw,
  Clock, Lock, AlertOctagon, HelpCircle, Terminal, Undo2
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import type { OperatorActivity, OperatorRisk } from '@/types'

const ACTION_LABELS: Record<string, string> = {
  login_failure: 'Failed Login',
  policy_edit: 'Policy Edit',
  containment_action: 'Containment Action',
  role_change: 'Role Change',
  settings_change: 'Settings Change',
  user_creation: 'User Creation',
  export_action: 'Export Action',
}

const RISK_LEVELS = [
  { level: 'CRITICAL', min: 76, color: 'text-danger border-danger/30 bg-danger/5', badge: 'danger' },
  { level: 'HIGH', min: 51, color: 'text-orange-500 border-orange-500/30 bg-orange-500/5', badge: 'warning' },
  { level: 'MEDIUM', min: 31, color: 'text-warning border-warning/30 bg-warning/5', badge: 'warning' },
  { level: 'LOW', min: 0, color: 'text-success border-success/30 bg-success/5', badge: 'success' },
]

function getRiskLevel(score: number) {
  return RISK_LEVELS.find(r => score >= r.min) || RISK_LEVELS[3]
}

export function OperatorSecurityPage() {
  const activeUser = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [selectedActivity, setSelectedActivity] = useState<OperatorActivity | null>(null)
  const [selectedOperatorEmail, setSelectedOperatorEmail] = useState<string | null>(null)
  const [anomalousOnly, setAnomalousOnly] = useState(false)
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({})

  // Fetch operator activity history logs
  const { data: activities, isLoading: actLoading } = useQuery({
    queryKey: ['operator-activities'],
    queryFn: () => api.getOperatorActivities(0, 100),
    refetchInterval: 5000,
  })

  // Fetch operator aggregated risk profiles
  const { data: risks, isLoading: riskLoading } = useQuery({
    queryKey: ['operator-risks'],
    queryFn: () => api.getOperatorRisks(),
    refetchInterval: 5000,
  })

  const resetMutation = useMutation({
    mutationFn: () => api.resetOperatorMonitoring(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-activities'] })
      queryClient.invalidateQueries({ queryKey: ['operator-risks'] })
      setSelectedOperatorEmail(null)
      setSelectedActivity(null)
    },
  })

  const isAdmin = activeUser?.role === 'admin'
  const filteredActivities = useMemo(() => {
    let list = activities || []
    if (anomalousOnly) list = list.filter(a => a.is_anomalous)
    if (selectedOperatorEmail) list = list.filter(a => a.user_email === selectedOperatorEmail)
    return list
  }, [activities, anomalousOnly, selectedOperatorEmail])

  // Get active selected operator profile
  const activeOperator = useMemo(() => {
    if (!risks || risks.length === 0) return null
    if (selectedOperatorEmail) {
      return risks.find(r => r.user_email === selectedOperatorEmail) || risks[0]
    }
    return risks[0]
  }, [risks, selectedOperatorEmail])

  // Set default selected email on load
  if (!selectedOperatorEmail && risks && risks.length > 0) {
    setSelectedOperatorEmail(risks[0].user_email)
  }

  const riskHistoryData = useMemo(() => {
    if (!activeOperator) return []
    const opActivities = (activities || [])
      .filter(a => a.user_email === activeOperator.user_email)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    let currentScore = 10
    return [
      { time: '09:00', score: 10 },
      ...opActivities.map((act) => {
        currentScore = Math.max(0, Math.min(100, currentScore + act.risk_delta))
        return {
          time: new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          score: currentScore
        }
      })
    ]
  }, [activeOperator, activities])

  const riskLevelInfo = useMemo(() => {
    return getRiskLevel(activeOperator?.risk_score || 0)
  }, [activeOperator])

  // Security Incident Alerts
  const opIncidents = useMemo(() => {
    if (!activeOperator) return []
    const alerts = []
    if (activeOperator.login_failures > 2) {
      alerts.push({
        id: 'INC-OP-101',
        title: 'Excessive Failed Login Attempts',
        desc: `${activeOperator.user_email} failed login check 5 times in 90 seconds.`,
        severity: 'HIGH',
        timestamp: '10:14 AM'
      })
    }
    if (activeOperator.policy_edits > 1) {
      alerts.push({
        id: 'INC-OP-102',
        title: 'Suspicious Policy Modifications',
        desc: `${activeOperator.user_email} modified containment threshold configuration at 03:12 AM.`,
        severity: 'CRITICAL',
        timestamp: '03:12 AM'
      })
    }
    if (activeOperator.export_actions > 2) {
      alerts.push({
        id: 'INC-OP-103',
        title: 'Abnormal Bulk Incident Data Export',
        desc: `Analyst exported 73 forensic sessions within 90 seconds.`,
        severity: 'CRITICAL',
        timestamp: '11:42 AM'
      })
    }
    if (activeOperator.containment_actions > 5) {
      alerts.push({
        id: 'INC-OP-104',
        title: 'Rapid Containment Actions Triggered',
        desc: `Operator executed containment commands against 11 agents in 3 minutes.`,
        severity: 'HIGH',
        timestamp: '02:22 PM'
      })
    }
    return alerts
  }, [activeOperator])

  const toggleCheck = (id: string) => {
    setChecklistState(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (actLoading && riskLoading) {
    return (
      <div className="space-y-4 text-sm animate-pulse">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <Skeleton className="h-8 w-40 bg-muted/20" />
            <Skeleton className="h-3.5 w-64 mt-1.5 bg-muted/20" />
          </div>
          <Skeleton className="h-8 w-24 bg-muted/20" />
        </div>
        <div className="grid grid-cols-12 gap-4 items-start">
          <div className="col-span-12 lg:col-span-6">
            <TableSkeleton rows={6} cols={4} />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <Skeleton className="h-[300px] w-full bg-muted/20" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground font-mono">Operator Security</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">Auditing administrative operations, policy changes, and gateway actions</p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
            <RefreshCw className={cn('h-3.5 w-3.5', resetMutation.isPending && 'animate-spin')} /> Reset Audit DB
          </Button>
        )}
      </div>

      {/* Main Interactive Split Panel */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Left Column: Operators list and activity timeline */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Operators Table */}
          <div className="rounded border bg-card overflow-hidden">
            <div className="px-3.5 py-2 border-b bg-muted/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Operators Registry</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b bg-muted/20 text-muted-foreground font-semibold">
                    <th className="px-4 py-2">User</th>
                    <th className="px-4 py-2 text-right">Risk Score</th>
                    <th className="px-4 py-2 text-right">MFA</th>
                    <th className="px-4 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(risks || []).map((risk) => {
                    const active = selectedOperatorEmail === risk.user_email
                    const level = getRiskLevel(risk.risk_score)
                    return (
                      <tr
                        key={risk.id}
                        onClick={() => {
                          setSelectedOperatorEmail(risk.user_email)
                          setSelectedActivity(null)
                        }}
                        className={cn(
                          'cursor-pointer hover:bg-muted/10 transition-colors',
                          active && 'bg-primary/5'
                        )}
                      >
                        <td className="px-4 py-2.5 font-medium">{risk.user_email}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold">
                          <span className={cn(risk.risk_score > 75 ? 'text-danger' : risk.risk_score > 35 ? 'text-warning' : 'text-success')}>
                            {risk.risk_score.toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-[10px]">ENABLED</td>
                        <td className="px-4 py-2.5 text-right">
                          <Badge variant={level.badge as any} className="text-[8px] font-mono leading-none">
                            {level.level}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operator Audit Timeline */}
          <div className="rounded border bg-card overflow-hidden">
            <div className="px-3.5 py-2 border-b bg-muted/10 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground" /> Audit Trail Timeline
              </h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAnomalousOnly(prev => !prev)} className={cn('h-6 text-[10px] px-1.5', anomalousOnly ? 'bg-danger/10 text-danger' : 'text-muted-foreground')}>
                  Anomalies Only
                </Button>
                {selectedOperatorEmail && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedOperatorEmail(null)} className="h-6 text-[10px] px-1.5 flex items-center gap-1">
                    <Undo2 className="h-3 w-3" /> Clear Filter
                  </Button>
                )}
              </div>
            </div>
            <div className="divide-y divide-border/40 max-h-[300px] overflow-y-auto">
              {filteredActivities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => setSelectedActivity(act)}
                  className={cn(
                    'p-2.5 hover:bg-muted/10 transition-colors cursor-pointer text-left',
                    selectedActivity?.id === act.id && 'bg-primary/5',
                    act.is_anomalous && 'border-l-2 border-danger'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {act.is_anomalous ? <AlertTriangle className="h-3 w-3 text-danger" /> : <User className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-xs font-bold truncate">{act.user_email}</span>
                      <Badge variant="outline" className="text-[8px] font-mono leading-none">{ACTION_LABELS[act.action] || act.action}</Badge>
                    </div>
                    <span className="text-xs font-mono font-bold text-danger">+{act.risk_delta}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate leading-relaxed pl-5">{act.details || 'Activity logged successfully'}</p>
                  <span className="text-[9px] text-muted-foreground pl-5 flex items-center gap-1 mt-0.5"><Clock className="h-2.5 w-2.5" /> {new Date(act.created_at).toLocaleString()}</span>
                </div>
              ))}
              {filteredActivities.length === 0 && (
                <p className="text-xs text-muted-foreground py-10 text-center">No operator actions logged</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Operator surveillance insights */}
        <div className="lg:col-span-6 space-y-4">
          {activeOperator && (
            <div className="rounded border bg-card p-4 space-y-5">
              
              {/* Text Scorecard (No circular gauge dials) */}
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-foreground">{activeOperator.user_email}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Calculated operator risk profile</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Risk Score</span>
                  <p className={cn("text-xl font-bold font-mono", activeOperator.risk_score > 75 ? 'text-danger' : activeOperator.risk_score > 35 ? 'text-warning' : 'text-success')}>
                    {activeOperator.risk_score.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
                  </p>
                </div>
              </div>

              {/* Flat Risk History Trend Area Chart */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Risk Score History</h4>
                <div className="h-[120px] rounded border p-2 bg-background">
                  {riskHistoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={riskHistoryData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                        <XAxis dataKey="time" stroke="#6B7280" fontSize={8} />
                        <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={8} />
                        <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937' }} />
                        <Area type="monotone" dataKey="score" stroke="rgb(239, 68, 68)" fill="rgba(239, 68, 68, 0.05)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">No history data</p>
                  )}
                </div>
              </div>

              {/* Generated Operator Alerts */}
              {opIncidents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-danger uppercase tracking-wider flex items-center gap-1.5">
                    <AlertOctagon className="h-3.5 w-3.5 text-danger animate-pulse" /> Anomalous operator alerts
                  </h4>
                  <div className="space-y-2">
                    {opIncidents.map((inc) => (
                      <div key={inc.id} className="rounded border border-danger/25 bg-danger/[0.02] p-2.5 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-danger flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {inc.title}</span>
                          <Badge variant="danger" className="text-[8px] font-mono leading-none">{inc.severity}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{inc.desc}</p>
                        <div className="flex justify-between items-center text-[8px] text-muted-foreground/80 mt-2 font-mono">
                          <span>ID: {inc.id}</span>
                          <span>Time: {inc.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Response Action Checklist */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" /> Recommended Response checklist
                </h4>
                <div className="space-y-1.5">
                  {([
                    { id: 'revoke', label: 'Revoke active login sessions' },
                    { id: 'mfa', label: 'Force step-up MFA challenge' },
                    { id: 'demote', label: 'Temporarily suspend admin roles' },
                    { id: 'audit', label: 'Download compliance logs' },
                  ]).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleCheck(item.id)}
                      className={cn(
                        'w-full flex items-center justify-between p-2 rounded border text-xs text-left transition-colors',
                        checklistState[item.id] ? 'bg-primary/10 border-primary text-foreground font-semibold' : 'bg-card text-muted-foreground hover:bg-muted/15'
                      )}
                    >
                      <span>{item.label}</span>
                      <span className={cn('h-3.5 w-3.5 rounded border flex items-center justify-center text-[8px]', checklistState[item.id] ? 'bg-primary border-primary text-white font-bold' : 'border-muted-foreground/40')}>
                        {checklistState[item.id] ? '✓' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Activity context helper box */}
          {selectedActivity && (
            <div className="rounded border bg-card p-3 text-xs space-y-2.5">
              <h4 className="font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" /> Activity Context Analysis
              </h4>
              <div className="bg-muted/10 p-2.5 rounded border space-y-1 font-mono text-[10px]">
                <p className="font-semibold text-danger">Delta score impact: +{selectedActivity.risk_delta}</p>
                <p className="leading-relaxed text-muted-foreground">{selectedActivity.anomaly_reason || `${selectedActivity.user_email} completed ${ACTION_LABELS[selectedActivity.action] || selectedActivity.action} operation.`}</p>
              </div>
              <div className="text-[10px] text-muted-foreground/90 space-y-0.5">
                <p>Host IP: <span className="font-mono">{selectedActivity.ip_address}</span></p>
                <p className="truncate">Payload: <span className="font-mono text-foreground">{selectedActivity.details || 'N/A'}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
