import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Code, CheckCircle, XCircle, AlertTriangle, Play, Copy, Terminal, FileCode } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'

const TEMPLATE = `ALLOW search_web
DENY download_customer_database IF ROLE "research"
ALLOW read_file IF ROLE "analyst" OR ROLE "operator"
DENY export_all_secrets
DENY root_shell
ALLOW http_get IF TIME "09:00-17:00"
`

const DSL_KEYWORDS = ['ALLOW', 'DENY', 'IF', 'ROLE', 'TIME', 'AND', 'OR', 'STARTS_WITH']

export function PolicyDSLPage() {
  const [source, setSource] = useState(TEMPLATE)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [cursorLine, setCursorLine] = useState(1)

  const validateMutation = useMutation({
    mutationFn: () => api.validatePolicyDSL(source),
  })

  const compileMutation = useMutation({
    mutationFn: () => api.compilePolicyDSL(source),
  })

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart, end = ta.selectionEnd
      setSource(source.substring(0, start) + '  ' + source.substring(end))
      setTimeout(() => ta.selectionStart = ta.selectionEnd = start + 2, 0)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    setCursorLine(source.substring(0, ta.selectionStart).split('\n').length)
  }

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    setCursorLine(source.substring(0, ta.selectionStart).split('\n').length)
  }

  const copySource = () => {
    navigator.clipboard.writeText(source)
  }

  const validationResult = validateMutation.data
  const compileResult = compileMutation.data

  const errors = validationResult?.errors || []
  const errorLines = new Set(errors.map((e) => e.line))

  return (
    <div className="space-y-5">
      <PageHeader title="Policy DSL" description="Write and compile AgentGuard policy rules using the domain-specific language" />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Editor</span>
              <Badge variant="outline" className="text-[8px] font-mono">.policy</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setShowLineNumbers((p) => !p)} className="h-7 px-2 text-muted-foreground">
                <FileCode className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={copySource} className="h-7 px-2 text-muted-foreground">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <textarea value={source} onChange={(e) => setSource(e.target.value)}
              onKeyDown={handleKeyDown} onScroll={handleScroll} onClick={handleClick}
              className="w-full h-[400px] bg-black/40 text-transparent caret-foreground font-mono text-xs leading-5 p-3 resize-none focus:outline-none"
              spellCheck={false} />
            <div className="absolute inset-0 pointer-events-none p-0 font-mono text-xs leading-5 overflow-hidden">
              {source.split('\n').map((line, i) => {
                const isError = errorLines.has(i + 1)
                const trimmed = line.trim()
                const firstWord = trimmed.split(/\s+/)[0]
                const isKeyword = DSL_KEYWORDS.includes(firstWord)
                return (
                  <div key={i} className={cn('flex', isError && 'bg-danger/[0.04]')}>
                    {showLineNumbers && (
                      <span className={cn('w-8 flex-shrink-0 text-right pr-2 select-none', cursorLine === i + 1 ? 'text-primary' : 'text-muted-foreground/30')}>{i + 1}</span>
                    )}
                    <span className={cn(
                      'whitespace-pre',
                      isKeyword ? 'text-primary font-semibold' :
                      isError ? 'text-danger' :
                      line.trim().startsWith('//') || line.trim().startsWith('#') ? 'text-muted-foreground/40 italic' :
                      trimmed.startsWith('"') ? 'text-success' :
                      'text-foreground/80'
                    )}>{line || '\u00A0'}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="px-3 py-1.5 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Line {cursorLine} | {source.split('\n').length} lines</span>
            <div className="flex gap-1">
              {DSL_KEYWORDS.map((kw) => (
                <span key={kw} className="text-primary/60 font-mono">{kw}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending} className="gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Validate
            </Button>
            <Button size="sm" onClick={() => compileMutation.mutate()} disabled={compileMutation.isPending} className="gap-1">
              <Play className="h-3.5 w-3.5" /> Compile
            </Button>
          </div>

          {validationResult && (
            <div className={cn('rounded-md border p-3', validationResult.valid ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5')}>
              <div className="flex items-center gap-2 mb-2">
                {validationResult.valid ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
                <span className={cn('text-sm font-medium', validationResult.valid ? 'text-success' : 'text-danger')}>
                  {validationResult.valid ? 'Valid DSL' : `${errors.length} error${errors.length > 1 ? 's' : ''} found`}
                </span>
              </div>
              {errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-danger">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>Line {e.line}: {e.message}</span>
                </div>
              ))}
            </div>
          )}

          {compileResult && (
            <div className="rounded-md border border-primary/30 bg-primary/5 overflow-hidden">
              <div className="px-3 py-2 border-b border-primary/20 flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" /> Compilation Result
                </span>
                <Badge variant="success" className="text-[9px]">{compileResult.rule_count} rule{compileResult.rule_count > 1 ? 's' : ''}</Badge>
              </div>
              <div className="divide-y divide-primary/10">
                {compileResult.rules.map((rule, i) => (
                  <div key={i} className="px-3 py-2 text-xs space-y-1 hover:bg-primary/[0.02] transition-colors">
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.action === 'ALLOW' ? 'success' : 'danger'} className="text-[8px]">{rule.action}</Badge>
                      <code className="font-mono text-[11px]">{rule.tool}</code>
                    </div>
                    {rule.conditions?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-1">
                        {rule.conditions.map((c: any, j: number) => (
                          <Badge key={j} variant="outline" className="text-[8px] font-mono">
                            {c.type === 'ROLE' ? `role=${c.value}` :
                             c.type === 'TIME' ? `time=${c.value}` : JSON.stringify(c)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {compileResult.rules.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">No rules compiled</div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-md border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <h3 className="text-sm font-medium flex items-center gap-2"><Terminal className="h-4 w-4 text-muted-foreground" /> DSL Reference</h3>
            </div>
            <div className="p-3 space-y-2 text-xs text-muted-foreground">
              <p><code className="text-primary font-semibold">ALLOW</code> &lt;tool_name&gt; — Allow a tool</p>
              <p><code className="text-danger font-semibold">DENY</code> &lt;tool_name&gt; — Deny a tool</p>
              <p><code className="text-primary font-semibold">IF</code> <code>ROLE</code> "&lt;role&gt;" — Conditional on role</p>
              <p><code className="text-primary font-semibold">IF</code> <code>TIME</code> "HH:MM-HH:MM" — Time window</p>
              <p><code className="text-primary font-semibold">AND</code>/<code className="text-primary font-semibold">OR</code> — Combine conditions</p>
              <p className="text-[10px] border-t border-border/50 pt-2 mt-2">Conditions after <code className="text-primary font-semibold">IF</code> are evaluated at runtime.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
