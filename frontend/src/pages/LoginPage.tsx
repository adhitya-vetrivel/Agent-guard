import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Swords, Activity } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginPage() {
  const [email, setEmail] = useState('admin@agentguard.io')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/command-center')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const fillDemoCredentials = (role: 'admin' | 'demo') => {
    if (role === 'admin') { setEmail('admin@agentguard.io'); setPassword('admin123') }
    else { setEmail('demo@agentguard.io'); setPassword('demo123') }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-mono">
      <div className="w-full max-w-sm px-4">
        <div className="rounded border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded border border-border bg-muted/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">AgentGuard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Runtime Identity & Behavior Firewall</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Email address</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@agentguard.io" required className="h-8 text-xs bg-card" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Security Password</label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="pr-8 h-8 text-xs bg-card" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {error && <p className="text-[11px] text-danger font-semibold">{error}</p>}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/95 text-white h-8 text-xs gap-1.5" disabled={loading}>
              {loading ? <><Activity className="h-3.5 w-3.5 animate-spin" /> Authenticating...</> : <><Shield className="h-3.5 w-3.5" /> Sign In</>}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/40 space-y-2">
            <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quick Demo Access</p>
            <div className="flex gap-2">
              <button onClick={() => fillDemoCredentials('admin')} className="flex-1 rounded border bg-muted/10 hover:bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-all">
                <span className="flex items-center justify-center gap-1"><Swords className="h-3 w-3" /> Admin</span>
              </button>
              <button onClick={() => fillDemoCredentials('demo')} className="flex-1 rounded border bg-muted/10 hover:bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-all">
                <span className="flex items-center justify-center gap-1"><Swords className="h-3 w-3" /> Analyst</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
