import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DecisionExplanationData } from '@/types'

interface DecisionExplanationProps {
  explanation: DecisionExplanationData
  compact?: boolean
  className?: string
}

export function DecisionExplanation({ explanation, compact = false, className }: DecisionExplanationProps) {
  const evidence = explanation.evidence
    ? Array.isArray(explanation.evidence)
      ? explanation.evidence
      : [explanation.evidence]
    : []

  return (
    <div className={cn(
      'rounded-md border border-primary/20 bg-primary/[0.03]',
      compact ? 'p-3' : 'p-4',
      className
    )}>
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Why?</span>
      </div>

      <dl className={cn('space-y-2.5', compact && 'space-y-2')}>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Decision</dt>
          <dd className="text-sm font-medium mt-0.5">{explanation.decision}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Reason</dt>
          <dd className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{explanation.reason}</dd>
        </div>
        {evidence.length > 0 && (
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Evidence</dt>
            <dd className="mt-0.5">
              <ul className="space-y-1">
                {evidence.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {explanation.rule_triggered && (
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Rule Triggered</dt>
            <dd className="text-xs font-mono mt-0.5 text-warning">{explanation.rule_triggered}</dd>
          </div>
        )}
        {explanation.risk_contribution !== undefined && explanation.risk_contribution !== null && (
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Risk Contribution</dt>
            <dd className="text-sm font-mono tabular-nums mt-0.5 text-danger">
              {typeof explanation.risk_contribution === 'number'
                ? `+${explanation.risk_contribution.toFixed(0)}`
                : explanation.risk_contribution}
            </dd>
          </div>
        )}
        {explanation.timestamp && (
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Timestamp</dt>
            <dd className="text-xs font-mono text-muted-foreground mt-0.5">
              {new Date(explanation.timestamp).toLocaleString()}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
